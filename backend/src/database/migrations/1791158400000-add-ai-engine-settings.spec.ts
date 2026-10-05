import { QueryRunner } from 'typeorm';
import { AddAiEngineSettings1791158400000 } from './1791158400000-add-ai-engine-settings';

it('creates a persistent configuration table protected from public database access', async () => {
  const query = jest.fn().mockResolvedValue(undefined);
  await new AddAiEngineSettings1791158400000().up({ query } as unknown as QueryRunner);
  expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('CREATE TABLE IF NOT EXISTS "ai_engine_settings"'));
  expect(query).toHaveBeenNthCalledWith(2, 'ALTER TABLE "ai_engine_settings" ENABLE ROW LEVEL SECURITY');
});
