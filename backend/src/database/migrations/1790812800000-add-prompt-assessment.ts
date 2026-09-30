import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the persisted, ordered prompt assessment shown to teachers. */
export class AddPromptAssessment1790812800000 implements MigrationInterface {
  readonly name = 'AddPromptAssessment1790812800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`
      ALTER TABLE "submissions"
        ADD COLUMN IF NOT EXISTS "aiPromptAssessment" text
    `);
  }

  // Removing this column would delete academic evidence already reviewed.
  async down(): Promise<void> {}
}
