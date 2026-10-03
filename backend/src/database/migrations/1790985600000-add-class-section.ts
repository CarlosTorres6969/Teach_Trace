import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the explicit class section while retaining legacy class data. */
export class AddClassSection1790985600000 implements MigrationInterface {
  readonly name = 'AddClassSection1790985600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`
      ALTER TABLE "classes"
        ADD COLUMN IF NOT EXISTS "section" character varying NOT NULL DEFAULT ''
    `);
  }

  // Kept irreversible so a rollback never discards sections already entered by teachers.
  async down(): Promise<void> {}
}
