import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiStageInstructions1791244800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "ai_engine_settings" ADD COLUMN IF NOT EXISTS "stageInstructions" text');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "ai_engine_settings" DROP COLUMN IF EXISTS "stageInstructions"');
  }
}
