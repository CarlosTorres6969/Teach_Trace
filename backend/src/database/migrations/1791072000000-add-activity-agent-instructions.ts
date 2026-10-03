import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds optional teacher guidance used by the AI analysis for each activity. */
export class AddActivityAgentInstructions1791072000000 implements MigrationInterface {
  readonly name = 'AddActivityAgentInstructions1791072000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`
      ALTER TABLE "activities"
        ADD COLUMN IF NOT EXISTS "agentInstructions" text NOT NULL DEFAULT ''
    `);
  }

  // Kept irreversible so a rollback never discards teacher-authored guidance.
  async down(): Promise<void> {}
}
