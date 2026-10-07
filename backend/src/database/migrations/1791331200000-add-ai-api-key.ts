import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiApiKey1791331200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "ai_engine_settings" ADD COLUMN IF NOT EXISTS "encryptedApiKey" text');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "ai_engine_settings" DROP COLUMN IF EXISTS "encryptedApiKey"');
  }
}
