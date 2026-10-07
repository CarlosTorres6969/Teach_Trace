import { BadRequestException, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiEngineSettings } from '../entities/ai-engine-settings.entity';
import { AI_STAGES, AiStageInstructions, DEFAULT_STAGE_INSTRUCTIONS } from './ai-stage-instructions';
import { VercelAiSyncResult, VercelAiSyncService } from './vercel-ai-sync.service';
import { AiApiKeyValidatorService } from './ai-api-key-validator.service';

export const DEFAULT_AI_MARKDOWN = `---
model: default
enabled: true
---
# Instrucciones para las actividades

Evalúa con evidencia concreta y explica las fortalezas y las mejoras del estudiante.
Respeta la rúbrica y los resultados de aprendizaje de cada actividad.
`;

export function parseAiMarkdown(markdown: string) {
  if (typeof markdown !== 'string' || markdown.length > 20_000) {
    throw new BadRequestException('El archivo Markdown debe tener como máximo 20000 caracteres');
  }
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(normalized);
  if (!match) throw new BadRequestException('El archivo debe iniciar con un bloque --- con model y enabled');
  const values: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const field = /^(model|enabled):\s*(\S+)\s*$/.exec(line);
    if (!field || values[field[1]] !== undefined) {
      throw new BadRequestException('Solo se permiten model y enabled, una vez cada uno');
    }
    values[field[1]] = field[2];
  }
  if (!values.model || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+-]{0,199}$/.test(values.model)) {
    throw new BadRequestException('model debe ser un identificador válido o default');
  }
  if (!['true', 'false'].includes(values.enabled)) {
    throw new BadRequestException('enabled debe ser true o false');
  }
  if (!match[2].trim()) throw new BadRequestException('Agrega instrucciones después del bloque de configuración');
  return { model: values.model, enabled: values.enabled === 'true', instructions: match[2].trim() };
}

@Injectable()
export class AiEngineSettingsService {
  constructor(
    @InjectRepository(AiEngineSettings) private readonly repository: Repository<AiEngineSettings>,
    private readonly config: ConfigService,
    private readonly keyValidator: AiApiKeyValidatorService,
    @Optional() private readonly vercelSync?: VercelAiSyncService,
  ) {}

  async getSettings() {
    const saved = await this.repository.findOneBy({ id: 1 });
    return this.publicSettings(saved);
  }

  private publicSettings(saved: AiEngineSettings | null) {
    const markdown = saved?.markdown ?? DEFAULT_AI_MARKDOWN;
    const parsed = parseAiMarkdown(markdown);
    return {
      markdown,
      ...parsed,
      stageInstructions: saved?.stageInstructions ?? { ...DEFAULT_STAGE_INSTRUCTIONS },
      effectiveModel: parsed.model === 'default' ? this.config.get<string>('AI_MODEL')?.trim() ?? '' : parsed.model,
      apiKeyConfigured: Boolean(saved?.encryptedApiKey || this.config.get<string>('AI_API_KEY')?.trim()),
      apiKeySource: saved?.encryptedApiKey ? 'admin' : this.config.get<string>('AI_API_KEY')?.trim() ? 'server' : 'none',
      vercelSyncConfigured: this.vercelSync?.isConfigured() ?? false,
      providerConfigured: Boolean(this.config.get<string>('AI_API_URL')?.trim() && (saved?.encryptedApiKey || this.config.get<string>('AI_API_KEY')?.trim())),
    };
  }

  // Solo para el motor: esta respuesta nunca se expone desde un controlador.
  async getRuntimeSettings() {
    const saved = await this.repository.findOneBy({ id: 1 });
    return {
      ...this.publicSettings(saved),
      apiKey: saved?.encryptedApiKey ? this.decryptApiKey(saved.encryptedApiKey) : this.config.get<string>('AI_API_KEY')?.trim() ?? '',
    };
  }

  async saveApiKey(apiKey: string) {
    const verifiedKey = await this.keyValidator.validate(apiKey);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(verifiedKey, 'utf8'), cipher.final()]);
    const encryptedApiKey = ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
    await this.writeApiKey(encryptedApiKey);
    const vercelSync = await this.syncWithVercel(verifiedKey);
    return { ...await this.getSettings(), vercelSync };
  }

  async retryVercelSync() {
    const saved = await this.repository.findOneBy({ id: 1 });
    if (!saved?.encryptedApiKey) throw new BadRequestException('Primero guarda una API key desde el panel');
    const apiKey = await this.keyValidator.validate(this.decryptApiKey(saved.encryptedApiKey));
    const vercelSync = await this.syncWithVercel(apiKey);
    return { ...await this.getSettings(), vercelSync };
  }

  private async syncWithVercel(apiKey: string): Promise<VercelAiSyncResult> {
    return this.vercelSync?.synchronize(apiKey) ?? {
      status: 'not_configured',
      message: 'La clave está guardada en la aplicación. La sincronización automática con Vercel necesita configurarse en el servidor.',
    };
  }

  async restoreServerApiKey() {
    await this.writeApiKey(null);
    return this.getSettings();
  }

  private async writeApiKey(encryptedApiKey: string | null) {
    const saved = await this.repository.findOneBy({ id: 1 });
    await this.repository.save(this.repository.create({
      id: 1,
      ...(saved ? {} : { markdown: DEFAULT_AI_MARKDOWN }),
      encryptedApiKey,
    }));
  }

  private encryptionKey() {
    const secret = this.config.get<string>('AI_SETTINGS_ENCRYPTION_KEY')?.trim() || this.config.get<string>('JWT_SECRET')?.trim();
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException('El servidor necesita un secreto de cifrado de al menos 32 caracteres para guardar la API key');
    }
    return createHash('sha256').update('teachtrace:ai-api-key:v1\0').update(secret).digest();
  }

  private decryptApiKey(value: string) {
    try {
      const [version, iv, tag, encrypted, extra] = value.split('.');
      if (version !== 'v1' || !iv || !tag || !encrypted || extra !== undefined) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException('No se pudo leer la API key guardada; vuelve a guardarla desde el panel de administración');
    }
  }

  async saveSettings(markdown: string) {
    parseAiMarkdown(markdown);
    await this.repository.save(this.repository.create({ id: 1, markdown }));
    return this.getSettings();
  }

  async saveStageSettings(input: {
    model: string;
    enabled: boolean;
    instructions: string;
    stageInstructions: AiStageInstructions;
  }) {
    if (typeof input.model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+-]{0,199}$/.test(input.model) || typeof input.enabled !== 'boolean') {
      throw new BadRequestException('Selecciona un modelo válido y el estado del motor de IA');
    }
    if (typeof input.instructions !== 'string' || input.instructions.length > 19_500 || !input.instructions.trim()) {
      throw new BadRequestException('Las instrucciones generales deben contener texto y no superar 19500 caracteres');
    }
    if (!input.stageInstructions || typeof input.stageInstructions !== 'object' || Array.isArray(input.stageInstructions) || Object.keys(input.stageInstructions).length !== AI_STAGES.length) {
      throw new BadRequestException('Incluye las instrucciones de los cinco puntos');
    }
    const stageInstructions = {} as AiStageInstructions;
    for (const stage of AI_STAGES) {
      const text = input.stageInstructions[stage.key];
      if (typeof text !== 'string' || !text.trim() || text.includes('\u0000') || text.length > 5_000) {
        throw new BadRequestException(`${stage.title}: escribe instrucciones de hasta 5000 caracteres`);
      }
      stageInstructions[stage.key] = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
    }
    const markdown = `---\nmodel: ${input.model}\nenabled: ${input.enabled}\n---\n${input.instructions.trim()}`;
    parseAiMarkdown(markdown);
    await this.repository.save(this.repository.create({ id: 1, markdown, stageInstructions }));
    return this.getSettings();
  }
}
