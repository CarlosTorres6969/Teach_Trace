import { MigrationInterface, QueryRunner } from 'typeorm';

/** Allows the intentionally limited platform-administrator account. */
export class AddAdminRole1790899200000 implements MigrationInterface {
  readonly name = 'AddAdminRole1790899200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`
      ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'admin'
    `);
  }

  // PostgreSQL enum values cannot be removed safely while referenced by users.
  async down(): Promise<void> {}
}
