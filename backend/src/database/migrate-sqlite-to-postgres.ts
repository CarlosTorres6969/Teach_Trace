import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import initSqlJs from 'sql.js';
import { DataSource, EntityMetadata } from 'typeorm';
import { Activity } from '../entities/activity.entity';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { AiConversation, AiMessage } from '../entities/ai-conversation.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { AcademicClass } from '../entities/class.entity';
import { Enrollment } from '../entities/enrollment.entity';
import { Indicator } from '../entities/indicator.entity';
import { Logbook } from '../entities/logbook.entity';
import { Notification } from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { PushSubscriptionEntity } from '../entities/push-subscription.entity';
import { Rubric } from '../entities/rubric.entity';
import { Submission } from '../entities/submission.entity';
import { User } from '../entities/user.entity';
import { Valuation } from '../entities/valuation.entity';

const entities = [
  User,
  AuthSession,
  PasswordResetToken,
  AcademicClass,
  Enrollment,
  Activity,
  Rubric,
  Logbook,
  AiDeclaration,
  AiConversation,
  AiMessage,
  Submission,
  Valuation,
  Indicator,
  NotificationPreference,
  Notification,
  PushSubscriptionEntity,
];

function loadProjectEnv() {
  const envPath = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '.env'),
  ].find((candidate) => existsSync(candidate));
  if (envPath) loadEnv({ path: envPath, override: false });
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function findSqlitePath() {
  return [
    resolve(process.cwd(), 'teachtrace.sqlite'),
    resolve(process.cwd(), '..', 'teachtrace.sqlite'),
  ].find((candidate) => existsSync(candidate));
}

function orderByForeignKeys(metadata: EntityMetadata[]) {
  const pending = new Map(metadata.map((item) => [item.tableName, item]));
  const ordered: EntityMetadata[] = [];

  while (pending.size) {
    const ready = [...pending.values()].filter((item) =>
      item.foreignKeys.every(
        (foreignKey) =>
          !pending.has(foreignKey.referencedEntityMetadata.tableName) ||
          foreignKey.referencedEntityMetadata.tableName === item.tableName,
      ),
    );

    // A cycle should not exist in the current model, but processing the
    // remaining tables makes the error explicit if a future model adds one.
    const batch = ready.length ? ready : [...pending.values()];
    for (const item of batch) {
      pending.delete(item.tableName);
      ordered.push(item);
    }
  }

  return ordered;
}

function normalizeValue(value: unknown, column: EntityMetadata['columns'][number]) {
  if (value === undefined) return null;
  if (column.type === Boolean || column.type === 'boolean') return Boolean(value);
  if (value === null) return null;
  if (column.type === Date || column.type === 'timestamp' || column.type === 'datetime') {
    return new Date(value as string | number | Date);
  }
  return value;
}

async function resetSequence(target: DataSource, metadata: EntityMetadata) {
  const generated = metadata.primaryColumns.find(
    (column) => column.isGenerated && column.generationStrategy === 'increment',
  );
  if (!generated) return;

  const sequenceRows = await target.query(
    'SELECT pg_get_serial_sequence($1, $2) AS sequence',
    [`public.${metadata.tableName}`, generated.databaseName],
  );
  const sequence = sequenceRows[0]?.sequence as string | null;
  if (!sequence) return;

  await target.query(
    `SELECT setval($1, GREATEST(COALESCE((SELECT MAX(${quoteIdentifier(generated.databaseName)}) FROM ${quoteIdentifier(metadata.tableName)}), 1), 1), true)`,
    [sequence],
  );
}

async function migrate() {
  loadProjectEnv();
  const sqlitePath = findSqlitePath();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!sqlitePath) throw new Error('No se encontró teachtrace.sqlite');
  if (!databaseUrl || databaseUrl.includes('[REPLACE_WITH_NEW_DB_PASSWORD]')) {
    throw new Error('DATABASE_URL no está configurada con una contraseña válida');
  }

  const target = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
    entities,
    synchronize: false,
  });

  await target.initialize();
  const wasmPath = [
    resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    resolve(process.cwd(), '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ].find((candidate) => existsSync(candidate));
  if (!wasmPath) throw new Error('No se encontró el runtime wasm de sql.js');
  const SqlJs = await initSqlJs({ locateFile: () => wasmPath });
  const sqlite = new SqlJs.Database(readFileSync(sqlitePath));
  try {
    const metadata = orderByForeignKeys(target.entityMetadatas);
    let total = 0;
    for (const item of metadata) {
      const result = sqlite.exec(`SELECT * FROM ${quoteIdentifier(item.tableName)}`);
      const rows: Record<string, unknown>[] = result.length
        ? result[0].values.map((values: unknown[]) =>
            Object.fromEntries(result[0].columns.map((column: string, index: number) => [column, values[index]])),
          )
        : [];
      if (!rows.length) continue;

      const columns = item.columns.filter((column) =>
        Object.prototype.hasOwnProperty.call(rows[0], column.databaseName),
      );
      const columnSql = columns.map((column) => quoteIdentifier(column.databaseName)).join(', ');
      for (const row of rows) {
        const values = columns.map((column) => normalizeValue(row[column.databaseName], column));
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        await target.query(
          `INSERT INTO ${quoteIdentifier(item.tableName)} (${columnSql}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values,
        );
      }
      await resetSequence(target, item);
      total += rows.length;
      console.log(`${item.tableName}: ${rows.length} filas`);
    }
    console.log(`Migración completada: ${total} filas procesadas.`);
  } finally {
    sqlite.close();
    await target.destroy();
  }
}

void migrate().catch((error: unknown) => {
  console.error('Migración fallida:', error);
  process.exitCode = 1;
});
