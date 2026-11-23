import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivityTeacherContext1795392000000 implements MigrationInterface {
  readonly name = 'AddActivityTeacherContext1795392000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query('ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "teacherContextDocument" text NULL');
  }

  // A rollback must not discard teacher-authored context.
  async down(): Promise<void> {}
}
