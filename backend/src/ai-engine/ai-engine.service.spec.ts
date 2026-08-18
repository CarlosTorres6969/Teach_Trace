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
});
