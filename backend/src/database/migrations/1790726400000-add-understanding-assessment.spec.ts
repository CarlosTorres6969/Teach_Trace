import { QueryRunner } from 'typeorm';
import { AddUnderstandingAssessment1790726400000 } from './1790726400000-add-understanding-assessment';

describe('AddUnderstandingAssessment1790726400000', () => {
  it('agrega solo las columnas de comprension en PostgreSQL', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connection: { options: { type: 'postgres' } },
      query,
    } as unknown as QueryRunner;

    await new AddUnderstandingAssessment1790726400000().up(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('"aiUnderstandingScore" integer');
    expect(query.mock.calls[0][0]).toContain('"aiUnderstandingExplanation" text');
    expect(query.mock.calls[0][0]).toContain('"aiLearningOutcomeAssessments" text');
    expect(query.mock.calls[0][0]).not.toContain('aiPromptAssessment');
  });

  it('no ejecuta la migracion en SQL.js', async () => {
    const query = jest.fn();
    const queryRunner = {
      connection: { options: { type: 'sqljs' } },
      query,
    } as unknown as QueryRunner;

    await new AddUnderstandingAssessment1790726400000().up(queryRunner);

    expect(query).not.toHaveBeenCalled();
  });
});
