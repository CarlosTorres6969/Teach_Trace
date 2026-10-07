import pdfParse from 'pdf-parse';
import { AiEngineService } from './ai-engine.service';
import { AI_STAGES, DEFAULT_STAGE_INSTRUCTIONS } from './ai-stage-instructions';

jest.mock('pdf-parse', () => ({ __esModule: true, default: jest.fn() }));

const rubric = [{
  name: 'Argumentación',
  dimension: 'Análisis',
  descriptors: {
    level1: 'Inicial',
    level2: 'Básico',
    level3: 'Competente',
    level4: 'Avanzado',
  },
}];

const providerResult = (overrides: Record<string, unknown> = {}) => ({
  detectedUsageLevel: 2,
  valuations: [{
    criterion: 'Argumentación',
    dimension: 'Análisis',
    level: 3,
    explanation: 'Relaciona evidencia y conclusiones.',
  }],
  feedback: 'Buen trabajo.',
  strengths: 'Argumentación clara.',
  improvements: 'Profundizar la validación.',
  understandingExplanation: 'Comprende el tema y relaciona la evidencia con el propósito.',
  learningOutcomeAssessments: [{
    learningOutcome: 'Argumenta una solución usando evidencia verificable.',
    score: 82,
    explanation: 'La conclusión se apoya en evidencia concreta.',
    evidence: ['Relaciona evidencia y conclusiones en el producto.'],
  }],
  promptDimensionScores: {
    relevance: 4,
    clarity: 3,
    refinement: 3,
    verification: 2,
    criticalThinking: 3,
  },
  promptAssessmentSummary: 'Los prompts son pertinentes y requieren mayor verificación.',
  promptAssessments: [
    {
      sequence: 4,
      purpose: 'refinement',
      score: 3,
      explanation: 'Refina la propuesta a partir de la respuesta anterior.',
    },
    {
      sequence: 0,
      purpose: 'verification',
      score: 3,
      explanation: 'Solicita contrastar la conclusión con evidencia.',
    },
  ],
  ...overrides,
});

const successfulResponse = (content: Record<string, unknown>) => new Response(
  JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
  { status: 200, headers: { 'content-type': 'application/json' } },
);

function configuredService(overrides: Record<string, string> = {}, settings?: { getRuntimeSettings: () => Promise<unknown> }) {
  const values = {
    AI_API_URL: 'https://example.test/v1/chat/completions',
    AI_API_KEY: 'test-key',
    AI_MODEL: 'test-model',
    AI_MAX_RETRIES: '0',
    AI_RETRY_BASE_DELAY_MS: '1',
    ...overrides,
  };
  return new AiEngineService({
    get: (key: string) => values[key as keyof typeof values],
  } as never, settings as never);
}

function evidence() {
  return {
    activity: {
      title: 'Ensayo de verificación',
      subject: 'Ingeniería de software',
      activityType: 'Ensayo',
      agentInstructions: 'Prioriza decisiones justificadas con evidencia.',
    },
    logbook: null,
    declaration: {
      toolName: 'ChatGPT',
      usageLevel: 2,
      purpose: 'Contrastar ideas',
      promptSummary: 'Resumen del proceso',
    },
    product: { text: 'Producto académico', url: '' },
    rubric,
    learningOutcomes: ['Argumenta una solución usando evidencia verificable.'],
    conversation: [
      { role: 'student', content: 'Mejora la conclusión después del contraste.', sequence: 4 },
      { role: 'ai', content: 'Conclusión refinada.', sequence: 5 },
      { role: 'student', content: 'Contrasta esta conclusión con la evidencia.', sequence: 0 },
      { role: 'ai', content: 'Respuesta de contraste.', sequence: 1 },
    ],
  };
}

describe('AiEngineService', () => {
  const originalFetch = global.fetch;

  it('uses the administrator API key when no server API key is set', async () => {
    global.fetch = jest.fn().mockResolvedValue(successfulResponse(providerResult()));
    const settings = { getRuntimeSettings: async () => ({ enabled: true, effectiveModel: 'admin/model', instructions: 'Reglas.', apiKey: 'test-only-panel-key' }) };
    const result = await configuredService({ AI_API_KEY: '' }, settings).analyzeEvidence(evidence());
    expect(result.implemented).toBe(true);
    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(request.headers.Authorization).toBe('Bearer test-only-panel-key');
    expect(request.body).not.toContain('test-only-panel-key');
  });

  it('does not send evidence if the saved key cannot be decrypted', async () => {
    global.fetch = jest.fn();
    const settings = { getRuntimeSettings: async () => { throw new Error('invalid ciphertext'); } };
    expect(await configuredService({}, settings).analyzeEvidence(evidence())).toMatchObject({ implemented: false, reason: expect.stringContaining('API key guardada') });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses the administrator model and Markdown instructions in the provider request', async () => {
    global.fetch = jest.fn().mockResolvedValue(successfulResponse(providerResult()));
    const settings = { getRuntimeSettings: async () => ({ enabled: true, effectiveModel: 'admin/model', instructions: '# Política\nContrasta las fuentes.', stageInstructions: DEFAULT_STAGE_INSTRUCTIONS }) };
    const result = await configuredService({ AI_MODEL: '' }, settings).analyzeEvidence(evidence());
    expect(result.implemented).toBe(true);
    const request = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(request.model).toBe('admin/model');
    expect(request.messages[0].content).toContain('# Política\nContrasta las fuentes.');
    for (const stage of AI_STAGES) {
      expect(request.messages[0].content).toContain(`COMPORTAMIENTO — ${stage.title}:\n${DEFAULT_STAGE_INSTRUCTIONS[stage.key]}`);
    }
    expect(request.messages[1].content).toContain('Prioriza decisiones justificadas con evidencia.');
  });

  it('does not send evidence to the provider when disabled by the administrator', async () => {
    global.fetch = jest.fn();
    const settings = { getRuntimeSettings: async () => ({ enabled: false, effectiveModel: 'admin/model', instructions: 'Política' }) };
    expect(await configuredService({}, settings).analyzeEvidence(evidence())).toMatchObject({ implemented: false, reason: expect.stringContaining('desactivó') });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('mantiene la protección que impide persistir resultados simulados', async () => {
    const result = await new AiEngineService().analyzeEvidence({
      logbook: null,
      declaration: null,
      product: { text: '', url: '' },
      rubric: [],
    });

    expect(result.implemented).toBe(false);
  });

  it('normaliza la respuesta por criterio sin generar una nota global', async () => {
    global.fetch = jest.fn().mockResolvedValue(successfulResponse(providerResult()));

    const result = await configuredService().analyzeEvidence(evidence());

    expect(result).toMatchObject({ implemented: true, detectedUsageLevel: 2 });
    if (result.implemented) {
      expect(result.valuations[0]).toMatchObject({ criterion: 'Argumentación', level: 3 });
      expect(result.requiresManualReview).toBe(true);
      expect(result.comparison).toContain('coincide');
      expect(result.understandingScore).toBe(82);
      expect(result.learningOutcomeAssessments[0]).toMatchObject({
        learningOutcome: 'Argumenta una solución usando evidencia verificable.',
        score: 82,
      });
      expect(result.promptAssessment).toMatchObject({
        scorePercentage: 66.67,
        prompts: [
          {
            sequence: 0,
            content: 'Contrasta esta conclusión con la evidencia.',
            purpose: 'verification',
            score: 3,
            explanation: 'Solicita contrastar la conclusión con evidencia.',
          },
          {
            sequence: 4,
            content: 'Mejora la conclusión después del contraste.',
            purpose: 'refinement',
            score: 3,
            explanation: 'Refina la propuesta a partir de la respuesta anterior.',
          },
        ],
      });
      expect(result).not.toHaveProperty('possibleGrade');
    }
    const request = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    ) as { messages: Array<{ content: string }> };
    expect(request.messages[1].content).not.toContain('possibleGrade');
    expect(request.messages[1].content).toContain('RESULTADOS_APRENDIZAJE_JSON');
    expect(request.messages[1].content).toContain('"sequence":0');
  });

  it('calcula la comprensión global como promedio de todos los resultados justificados', async () => {
    global.fetch = jest.fn().mockResolvedValue(successfulResponse(providerResult({
      learningOutcomeAssessments: [
        {
          learningOutcome: 'Argumenta una solución usando evidencia verificable.',
          score: 80,
          explanation: 'Argumenta con evidencia.',
          evidence: ['Evidencia A.'],
        },
        {
          learningOutcome: 'Valida decisiones mediante casos límite.',
          score: 90,
          explanation: 'Valida decisiones de forma explícita.',
          evidence: ['Evidencia B.'],
        },
      ],
    })));
    const input = evidence();
    input.learningOutcomes.push('Valida decisiones mediante casos límite.');

    const result = await configuredService().analyzeEvidence(input);

    expect(result).toMatchObject({ implemented: true, understandingScore: 85 });
  });

  it('rechaza puntajes transformados o sin evidencia y no completa un promedio parcial', async () => {
    global.fetch = jest.fn().mockResolvedValue(successfulResponse(providerResult({
      learningOutcomeAssessments: [{
        learningOutcome: 'Argumenta una solución usando evidencia verificable.',
        score: '82',
        explanation: 'Explicación presente.',
        evidence: ['Evidencia presente.'],
      }],
    })));

    const result = await configuredService().analyzeEvidence(evidence());

    expect(result).toMatchObject({ implemented: true, understandingScore: null });
    if (result.implemented) {
      expect(result.learningOutcomeAssessments[0].score).toBeNull();
    }
  });

  it('exige evidencia para todos los resultados e ignora resultados inventados por el proveedor', async () => {
    global.fetch = jest.fn().mockResolvedValue(successfulResponse(providerResult({
      learningOutcomeAssessments: [
        {
          learningOutcome: 'Argumenta una solución usando evidencia verificable.',
          score: 80,
          explanation: 'Argumenta con evidencia.',
          evidence: ['Evidencia A.'],
        },
        {
          learningOutcome: 'Valida decisiones mediante casos límite.',
          score: 90,
          explanation: 'La explicación existe, pero no cita evidencia.',
          evidence: [],
        },
        {
          learningOutcome: 'Resultado no configurado por el docente.',
          score: 100,
          explanation: 'No debe persistirse.',
          evidence: ['Evidencia inventada.'],
        },
      ],
    })));
    const input = evidence();
    input.learningOutcomes.push('Valida decisiones mediante casos límite.');

    const result = await configuredService().analyzeEvidence(input);

    expect(result).toMatchObject({ implemented: true, understandingScore: null });
    if (result.implemented) {
      expect(result.learningOutcomeAssessments).toHaveLength(2);
      expect(result.learningOutcomeAssessments[0].score).toBe(80);
      expect(result.learningOutcomeAssessments[1].score).toBeNull();
      expect(result.learningOutcomeAssessments).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ learningOutcome: 'Resultado no configurado por el docente.' }),
      ]));
    }
  });

  it('marca la comprensión como no determinable cuando la actividad no tiene resultados', async () => {
    global.fetch = jest.fn().mockResolvedValue(successfulResponse(providerResult()));
    const input = evidence();
    input.learningOutcomes = [];

    const result = await configuredService().analyzeEvidence(input);

    expect(result).toMatchObject({
      implemented: true,
      understandingScore: null,
      learningOutcomeAssessments: [],
    });
    if (result.implemented) {
      expect(result.understandingExplanation).toContain('no tiene resultados de aprendizaje');
    }
  });

  it('omite la valoración de prompts cuando no existe conversación del estudiante', async () => {
    global.fetch = jest.fn().mockResolvedValue(successfulResponse(providerResult()));
    const input = evidence();
    input.conversation = [];

    const result = await configuredService().analyzeEvidence(input);

    expect(result).toMatchObject({ implemented: true, promptAssessment: null });
  });

  it('no incluye el nivel declarado ni identificadores conocidos en la evidencia enviada', async () => {
    global.fetch = jest.fn().mockResolvedValue(successfulResponse(providerResult()));
    const input = evidence();
    input.product.text = 'Trabajo elaborado por Ana Pérez, ana.perez@unah.edu.hn';

    await configuredService().analyzeEvidence({
      ...input,
      identityTerms: ['Ana Pérez', 'ana.perez@unah.edu.hn'],
    });

    const request = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    ) as { messages: Array<{ content: string }> };
    const prompt = request.messages[1].content;
    expect(prompt).not.toContain('Ana Pérez');
    expect(prompt).not.toContain('ana.perez@unah.edu.hn');
    expect(prompt).not.toContain('"usageLevel":2');
    expect(prompt).toContain('[DATO_PERSONAL]');
  });

  it('incluye por separado las instrucciones autorizadas del docente', async () => {
    global.fetch = jest.fn().mockResolvedValue(successfulResponse(providerResult()));

    await configuredService().analyzeEvidence(evidence());

    const request = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    ) as { messages: Array<{ content: string }> };
    expect(request.messages[0].content).toContain('instrucciones del docente');
    expect(request.messages[1].content).toContain('INSTRUCCIONES_DOCENTE_AUTORIZADAS');
    expect(request.messages[1].content).toContain('Prioriza decisiones justificadas con evidencia.');
  });

  it('extrae el texto del PDF y lo incorpora al análisis sin enviar el nombre del archivo', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    (pdfParse as unknown as jest.Mock).mockImplementation(() => ({
      getText: jest.fn().mockResolvedValue({ text: 'Contenido académico dentro del PDF' }),
      destroy,
    }));
    global.fetch = jest.fn().mockResolvedValue(successfulResponse(providerResult()));

    await configuredService().analyzeEvidence({
      ...evidence(),
      product: {
        text: '',
        url: '',
        document: { mimeType: 'application/pdf', content: Buffer.from('%PDF-1.7') },
      },
    });

    const request = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    ) as { messages: Array<{ content: string }> };
    expect(request.messages[1].content).toContain('Contenido académico dentro del PDF');
    expect(request.messages[1].content).not.toContain('archivo.pdf');
    expect(destroy).toHaveBeenCalled();
  });

  it('reintenta respuestas transitorias antes de degradar a revisión manual', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(successfulResponse(providerResult()));

    const result = await configuredService({ AI_MAX_RETRIES: '1' }).analyzeEvidence(evidence());

    expect(result.implemented).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('rechaza niveles transformados y no conserva un nivel sin justificación', async () => {
    global.fetch = jest.fn().mockResolvedValue(successfulResponse(providerResult({
      detectedUsageLevel: '2',
      valuations: [{
        criterion: 'Argumentación',
        dimension: 'Análisis',
        level: true,
        explanation: '   ',
      }],
      promptDimensionScores: {
        relevance: true,
        clarity: 3,
        refinement: 3,
        verification: 2,
        criticalThinking: 3,
      },
      promptAssessments: [
        { sequence: 0, purpose: 'verification', score: 4, explanation: '   ' },
        { sequence: 99, purpose: 'other', score: 4, explanation: 'No corresponde.' },
      ],
    })));

    const result = await configuredService().analyzeEvidence(evidence());

    expect(result).toMatchObject({ implemented: true, detectedUsageLevel: null });
    if (result.implemented) {
      expect(result.valuations[0].level).toBeNull();
      expect(result.valuations[0].explanation).toContain('No determinable');
      expect(result.promptAssessment?.scorePercentage).toBeNull();
      expect(result.promptAssessment?.prompts).toEqual([
        expect.objectContaining({ sequence: 0, score: null }),
        expect.objectContaining({ sequence: 4, score: null }),
      ]);
      expect(result.promptAssessment?.prompts).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ sequence: 99 }),
      ]));
    }
  });
});
