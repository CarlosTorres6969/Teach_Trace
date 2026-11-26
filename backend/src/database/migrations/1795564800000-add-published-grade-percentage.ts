import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPublishedGradePercentage1795564800000 implements MigrationInterface {
  readonly name = 'AddPublishedGradePercentage1795564800000';
  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query('ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "publishedGradePercentage" double precision NULL');
  }
  async down(): Promise<void> {}
}
