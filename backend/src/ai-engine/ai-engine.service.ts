import { Injectable } from '@nestjs/common';
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
  product: { text: string; url: string; fileName: string | null };
  rubric: RubricCriterion[];
};

export type AiAnalysisResult =
  | { implemented: false; reason: string }
  | {
      implemented: true;
      detectedUsageLevel: number | null;
      valuations: Array<{
        dimension: string;
        level: number | null;
        explanation: string;
      }>;
    };

@Injectable()
export class AiEngineService {
  async analyzeEvidence(_evidence: AcademicEvidence): Promise<AiAnalysisResult> {
    return {
      implemented: false,
      reason: 'El proveedor de IA todavía no ha sido configurado',
    };
  }
}
