import { QueryRunner } from 'typeorm';
import { AddPromptAssessment1790812800000 } from './1790812800000-add-prompt-assessment';

describe('AddPromptAssessment1790812800000', () => {
  it('agrega únicamente la valoración de prompts en PostgreSQL', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connection: { options: { type: 'postgres' } },
      query,
    } as unknown as QueryRunner;

    const migration = new AddPromptAssessment1790812800000();
    await migration.up(queryRunner);

    expect(migration.name).toMatch(/\d{13}$/);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('"aiPromptAssessment" text');
    expect(query.mock.calls[0][0]).not.toContain('aiUnderstandingScore');
  });

  it('no ejecuta la migración en SQL.js', async () => {
    const query = jest.fn();
    const queryRunner = {
      connection: { options: { type: 'sqljs' } },
      query,
    } as unknown as QueryRunner;

    await new AddPromptAssessment1790812800000().up(queryRunner);

    expect(query).not.toHaveBeenCalled();
  });
});
