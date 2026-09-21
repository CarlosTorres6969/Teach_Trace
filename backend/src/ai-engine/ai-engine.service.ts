import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RubricCriterion } from '../entities/rubric.entity';

export type AcademicEvidence = {
  logbook: {
    initialIdeas: string;
    prompts: string;
    validationsAndDecisions: string;
    finalReflection: string;
  } | null;
  declaration: {
    toolName: string;
    usageLevel: number;
    purpose: string;
    promptSummary: string;
  } | null;
  conversation?: Array<{ role: string; content: string }>;
  product: { text: string; url: string; fileName: string | null };
  rubric: RubricCriterion[];
};

export type AiAnalysisResult =
  | { implemented: false; reason: string }
  | {
      implemented: true;
      requiresManualReview: boolean;
      detectedUsageLevel: number | null;
      possibleGrade: number | null;
      valuations: Array<{
        dimension: string;
        criterion: string;
        level: number | null;
        explanation: string;
      }>;
      feedback: string;
      strengths: string;
      improvements: string;
      comparison: string;
    };

type ProviderResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_INPUT_CHARS = 100_000;

@Injectable()
export class AiEngineService {
  private readonly logger = new Logger(AiEngineService.name);

  constructor(@Optional() private readonly config?: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config?.get<string>('AI_API_KEY')?.trim() &&
        this.config?.get<string>('AI_API_URL')?.trim() &&
        this.config?.get<string>('AI_MODEL')?.trim(),
    );
  }

  async analyzeEvidence(evidence: AcademicEvidence): Promise<AiAnalysisResult> {
    if (!this.isConfigured()) {
      return {
        implemented: false,
        reason: 'El proveedor de IA no está configurado (AI_API_URL, AI_API_KEY y AI_MODEL)',
      };
    }
    if (!evidence.rubric.length) {
      return { implemented: false, reason: 'La actividad no tiene una rúbrica asociada' };
    }

    const apiUrl = this.config!.get<string>('AI_API_URL')!.trim();
    const apiKey = this.config!.get<string>('AI_API_KEY')!.trim();
    const model = this.config!.get<string>('AI_MODEL')!.trim();
    const timeoutMs = this.readPositiveInt('AI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
    const maxInputChars = this.readPositiveInt('AI_MAX_INPUT_CHARS', DEFAULT_MAX_INPUT_CHARS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(this.config?.get<string>('AI_HTTP_REFERER')
            ? { 'HTTP-Referer': this.config.get<string>('AI_HTTP_REFERER')! }
            : {}),
          ...(this.config?.get<string>('AI_X_TITLE')
            ? { 'X-Title': this.config.get<string>('AI_X_TITLE')! }
            : {}),
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content:
                'Eres un evaluador académico auxiliar. Responde únicamente con un objeto JSON válido, sin markdown ni texto adicional. No inventes evidencia: si un criterio no puede justificarse, usa level:null y explica por qué.',
            },
            { role: 'user', content: this.buildPrompt(evidence, maxInputChars) },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(`Proveedor IA respondió ${response.status}: ${body.slice(0, 300)}`);
        return { implemented: false, reason: `El proveedor de IA respondió HTTP ${response.status}` };
      }
      const payload = (await response.json()) as ProviderResponse;
      const parsed = this.parseJson(payload.choices?.[0]?.message?.content);
      if (!parsed) {
        return { implemented: false, reason: 'La respuesta del proveedor IA no contiene JSON válido' };
      }
      return this.normalizeResult(parsed, evidence.rubric);
    } catch (error: unknown) {
      const reason = error instanceof Error && error.name === 'AbortError'
        ? 'El proveedor de IA agotó el tiempo de espera'
        : 'No fue posible comunicarse con el proveedor de IA';
      this.logger.warn(`${reason}: ${String(error)}`);
      return { implemented: false, reason };
    } finally {
      clearTimeout(timer);
    }
  }

  private buildPrompt(evidence: AcademicEvidence, maxInputChars: number): string {
    const source = {
      declaracion: evidence.declaration,
      bitacora: evidence.logbook,
      conversacion: evidence.conversation ?? [],
      producto: {
        texto: evidence.product.text,
        enlace: evidence.product.url,
        archivo: evidence.product.fileName,
      },
      rubrica: evidence.rubric.map((criterion) => ({
        criterio: criterion.name,
        dimension: criterion.dimension,
        niveles: criterion.descriptors,
      })),
    };
    return [
      'Analiza la evidencia de una entrega académica y devuelve exactamente este esquema:',
      '{"detectedUsageLevel":1|2|3|null,"possibleGrade":0-100|null,"valuations":[{"criterion":"...","dimension":"...","level":1|2|3|4|null,"explanation":"..."}],"feedback":"...","strengths":"...","improvements":"...","comparison":"..."}',
      'detectedUsageLevel estima el nivel de uso de IA: 1=nulo o mínimo, 2=apoyo parcial, 3=uso sustantivo. Compáralo con la declaración solo usando la evidencia recibida.',
      'Devuelve un elemento de valuations por cada criterio de la rúbrica, usando exactamente sus nombres. La explicación debe mencionar evidencia concreta, fortalezas y aspectos por mejorar.',
      'possibleGrade es una sugerencia numerica de 0 a 100 basada exclusivamente en la rubrica y la evidencia. No reemplaza la decision docente.',
      'strengths resume que hizo bien el estudiante e improvements resume que debe mejorar. Si no hay evidencia suficiente, dilo explicitamente.',
      `EVIDENCIA_JSON:\n${JSON.stringify(source).slice(0, maxInputChars)}`,
    ].join('\n\n');
  }

  private parseJson(content: unknown): Record<string, unknown> | null {
    if (typeof content !== 'string') return null;
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try {
      const value: unknown = JSON.parse(cleaned);
      return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start < 0 || end <= start) return null;
      try {
        const value: unknown = JSON.parse(cleaned.slice(start, end + 1));
        return value && typeof value === 'object' && !Array.isArray(value)
          ? value as Record<string, unknown>
          : null;
      } catch {
        return null;
      }
    }
  }

  private normalizeResult(
    raw: Record<string, unknown>,
    rubric: RubricCriterion[],
  ): Extract<AiAnalysisResult, { implemented: true }> {
    const rawValuations = Array.isArray(raw.valuations) ? raw.valuations : [];
    const valuations = rubric.map((criterion) => {
      const match = rawValuations.find((item) => {
        if (!item || typeof item !== 'object') return false;
        const value = item as Record<string, unknown>;
        return value.criterion === criterion.name || value.dimension === criterion.dimension;
      }) as Record<string, unknown> | undefined;
      const level = this.level(match?.level, 4);
      return {
        dimension: criterion.dimension,
        criterion: criterion.name,
        level,
        explanation: this.text(match?.explanation) || 'La IA no justificó este criterio; requiere revisión docente.',
      };
    });
    const detectedUsageLevel = this.level(raw.detectedUsageLevel, 3);
    const possibleGrade = this.score(raw.possibleGrade) ?? this.derivePossibleGrade(valuations);
    return {
      implemented: true,
      requiresManualReview: valuations.some((valuation) => valuation.level === null) || detectedUsageLevel === null,
      detectedUsageLevel,
      possibleGrade,
      valuations,
      feedback: this.text(raw.feedback),
      strengths: this.text(raw.strengths),
      improvements: this.text(raw.improvements),
      comparison: this.text(raw.comparison),
    };
  }

  private level(value: unknown, max: number): number | null {
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(number) && number >= 1 && number <= max ? number : null;
  }

  private score(value: unknown): number | null {
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 100
      ? Math.round(number * 100) / 100
      : null;
  }

  private derivePossibleGrade(valuations: Array<{ level: number | null }>): number | null {
    const levels = valuations
      .map((valuation) => valuation.level)
      .filter((level): level is number => level !== null);
    if (!levels.length) return null;
    return Math.round((levels.reduce((sum, level) => sum + level, 0) / levels.length / 4) * 10000) / 100;
  }

  private text(value: unknown): string {
    return typeof value === 'string' ? value.trim().slice(0, 5000) : '';
  }

  private readPositiveInt(key: string, fallback: number): number {
    const value = Number(this.config?.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
