import { QueryRunner } from 'typeorm';
import { AddAiEvaluationProductionSchema202609290001 } from './202609290001-add-ai-evaluation-production-schema';

describe('AddAiEvaluationProductionSchema202609290001', () => {
  it('agrega las columnas IA y amplia los enums existentes de PostgreSQL', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        { schemaName: 'public', typeName: 'notifications_type_enum' },
      ])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        {
          schemaName: 'public',
          typeName: 'notification_preferences_eventType_enum',
        },
      ])
      .mockResolvedValueOnce(undefined);
    const queryRunner = {
      connection: { options: { type: 'postgres' } },
      query,
    } as unknown as QueryRunner;

    await new AddAiEvaluationProductionSchema202609290001().up(queryRunner);

    expect(query.mock.calls[0][0]).toContain('ADD COLUMN IF NOT EXISTS "aiUnderstandingScore"');
    expect(query.mock.calls[0][0]).toContain('ADD COLUMN IF NOT EXISTS "aiPromptAssessment"');
    expect(query.mock.calls[1][1]).toEqual(['notifications', 'type']);
    expect(query.mock.calls[2][0]).toContain(
      'ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS',
    );
    expect(query.mock.calls[3][1]).toEqual([
      'notification_preferences',
      'eventType',
    ]);
    expect(query.mock.calls[4][0]).toContain(
      'ALTER TYPE "public"."notification_preferences_eventType_enum" ADD VALUE IF NOT EXISTS',
    );
  });

  it('no ejecuta SQL en la base local SQL.js', async () => {
    const query = jest.fn();
    const queryRunner = {
      connection: { options: { type: 'sqljs' } },
      query,
    } as unknown as QueryRunner;

    await new AddAiEvaluationProductionSchema202609290001().up(queryRunner);

    expect(query).not.toHaveBeenCalled();
  });
});
