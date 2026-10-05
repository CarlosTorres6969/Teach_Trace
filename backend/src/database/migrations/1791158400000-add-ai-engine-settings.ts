import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiEngineSettings1791158400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "ai_engine_settings" (
      "id" integer PRIMARY KEY,
      "markdown" text NOT NULL
    )`);
    await queryRunner.query('ALTER TABLE "ai_engine_settings" ENABLE ROW LEVEL SECURITY');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "ai_engine_settings"');
  }
}
