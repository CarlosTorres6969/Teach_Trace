import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds only the persisted comprehension assessment used by the teacher view. */
export class AddUnderstandingAssessment1790726400000 implements MigrationInterface {
  readonly name = 'AddUnderstandingAssessment1790726400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`
      ALTER TABLE "submissions"
        ADD COLUMN IF NOT EXISTS "aiUnderstandingScore" integer,
        ADD COLUMN IF NOT EXISTS "aiUnderstandingExplanation" text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS "aiLearningOutcomeAssessments" text NOT NULL DEFAULT '[]'
    `);
  }

  // This compatibility migration is intentionally irreversible: rolling it
  // back must never delete academic assessment evidence already persisted.
  async down(): Promise<void> {}
}
