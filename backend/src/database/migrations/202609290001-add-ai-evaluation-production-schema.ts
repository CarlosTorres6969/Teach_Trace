import { MigrationInterface, QueryRunner } from 'typeorm';

type EnumMetadata = {
  schemaName: string;
  typeName: string;
};

/**
 * Keeps persistent PostgreSQL installations aligned with the AI evaluation
 * fields. Local SQL.js databases continue to use synchronize and never run
 * this migration.
 */
export class AddAiEvaluationProductionSchema202609290001 implements MigrationInterface {
  readonly name = 'AddAiEvaluationProductionSchema202609290001';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`
      ALTER TABLE "submissions"
        ADD COLUMN IF NOT EXISTS "aiUnderstandingScore" integer,
        ADD COLUMN IF NOT EXISTS "aiUnderstandingExplanation" text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS "aiLearningOutcomeAssessments" text NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "aiPromptAssessment" text
    `);

    await this.addEnumValue(
      queryRunner,
      'notifications',
      'type',
      'AI_ANALYSIS_READY',
    );
    await this.addEnumValue(
      queryRunner,
      'notification_preferences',
      'eventType',
      'AI_ANALYSIS_READY',
    );
  }

  // PostgreSQL cannot safely remove individual enum values. Keeping the
  // nullable columns is also safer than deleting persisted evaluation data.
  async down(): Promise<void> {}

  private async addEnumValue(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
    value: string,
  ) {
    const rows = (await queryRunner.query(
      `
        SELECT namespace.nspname AS "schemaName", type.typname AS "typeName"
        FROM pg_attribute attribute
        INNER JOIN pg_class table_info ON table_info.oid = attribute.attrelid
        INNER JOIN pg_namespace namespace ON namespace.oid = table_info.relnamespace
        INNER JOIN pg_type type ON type.oid = attribute.atttypid
        WHERE namespace.nspname = current_schema()
          AND table_info.relname = $1
          AND attribute.attname = $2
          AND attribute.attnum > 0
          AND NOT attribute.attisdropped
          AND type.typtype = 'e'
        LIMIT 1
      `,
      [tableName, columnName],
    )) as EnumMetadata[];
    const metadata = rows[0];
    if (!metadata) return;

    await queryRunner.query(
      `ALTER TYPE ${this.identifier(metadata.schemaName)}.${this.identifier(metadata.typeName)} ` +
        `ADD VALUE IF NOT EXISTS ${this.literal(value)}`,
    );
  }

  private identifier(value: string) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  private literal(value: string) {
    return `'${value.replaceAll("'", "''")}'`;
  }
}
