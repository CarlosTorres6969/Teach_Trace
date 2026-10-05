import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiEngineSettings } from '../entities/ai-engine-settings.entity';

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
  ) {}

  async getSettings() {
    const saved = await this.repository.findOneBy({ id: 1 });
    const markdown = saved?.markdown ?? DEFAULT_AI_MARKDOWN;
    const parsed = parseAiMarkdown(markdown);
    return {
      markdown,
      ...parsed,
      effectiveModel: parsed.model === 'default' ? this.config.get<string>('AI_MODEL')?.trim() ?? '' : parsed.model,
      providerConfigured: Boolean(this.config.get<string>('AI_API_URL')?.trim() && this.config.get<string>('AI_API_KEY')?.trim()),
    };
  }

  async saveSettings(markdown: string) {
    parseAiMarkdown(markdown);
    await this.repository.save(this.repository.create({ id: 1, markdown }));
    return this.getSettings();
  }
}
