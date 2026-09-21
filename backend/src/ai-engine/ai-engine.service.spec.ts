import { AiEngineService } from './ai-engine.service';

describe('AiEngineService', () => {
  it('mantiene la protección que impide persistir resultados simulados', async () => {
    const result = await new AiEngineService().analyzeEvidence({
      logbook: null,
      declaration: null,
      product: { text: '', url: '', fileName: null },
      rubric: [],
    });

    expect(result.implemented).toBe(false);
  });

  it('consume una respuesta JSON compatible con Chat Completions y la normaliza a la rúbrica', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              detectedUsageLevel: 2,
              valuations: [{
                criterion: 'Argumentación',
                dimension: 'Análisis',
                level: 3,
                explanation: 'Relaciona evidencia y conclusiones.',
              }],
              feedback: 'Buen trabajo.',
              comparison: 'La declaración coincide parcialmente.',
            }),
          },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const config = {
      get: (key: string) => ({
        AI_API_URL: 'https://example.test/v1/chat/completions',
        AI_API_KEY: 'test-key',
        AI_MODEL: 'test-model',
      } as Record<string, string>)[key],
    };
    const service = new AiEngineService(config as never);

    const result = await service.analyzeEvidence({
      logbook: null,
      declaration: { toolName: 'ChatGPT', usageLevel: 2, purpose: 'Ideas', promptSummary: 'Resumen' },
      product: { text: 'Producto', url: '', fileName: 'tarea.pdf' },
      rubric: [{
        name: 'Argumentación',
        dimension: 'Análisis',
        descriptors: { level1: 'Inicial', level2: 'Básico', level3: 'Competente', level4: 'Avanzado' },
      }],
    });

    expect(result).toMatchObject({ implemented: true, detectedUsageLevel: 2 });
    if (result.implemented) {
      expect(result.valuations[0]).toMatchObject({ criterion: 'Argumentación', level: 3 });
      expect(result.requiresManualReview).toBe(false);
    }
    expect(global.fetch).toHaveBeenCalledTimes(1);
    global.fetch = originalFetch;
  });
});
