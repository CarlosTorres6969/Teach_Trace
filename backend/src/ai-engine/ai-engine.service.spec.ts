import pdfParse from 'pdf-parse';
import { AiEngineService } from './ai-engine.service';

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
  ...overrides,
});

const successfulResponse = (content: Record<string, unknown>) => new Response(
  JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
  { status: 200, headers: { 'content-type': 'application/json' } },
);

function configuredService(overrides: Record<string, string> = {}) {
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
  } as never);
}

function evidence() {
  return {
    logbook: null,
    declaration: {
      toolName: 'ChatGPT',
      usageLevel: 2,
      purpose: 'Contrastar ideas',
      promptSummary: 'Resumen del proceso',
    },
    product: { text: 'Producto académico', url: '' },
    rubric,
  };
}

describe('AiEngineService', () => {
  const originalFetch = global.fetch;

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
      expect(result).not.toHaveProperty('possibleGrade');
    }
    const request = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    ) as { messages: Array<{ content: string }> };
    expect(request.messages[1].content).not.toContain('possibleGrade');
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
    })));

    const result = await configuredService().analyzeEvidence(evidence());

    expect(result).toMatchObject({ implemented: true, detectedUsageLevel: null });
    if (result.implemented) {
      expect(result.valuations[0].level).toBeNull();
      expect(result.valuations[0].explanation).toContain('No determinable');
    }
  });
});
