import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const { Client } = require('pg') as {
  Client: new (options: { connectionString: string; ssl: { rejectUnauthorized: boolean } }) => any;
};

const envPath = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')].find((candidate) =>
  existsSync(candidate),
);
if (envPath) loadEnv({ path: envPath, override: false });

async function verify() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const tables = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    console.log('Tablas public:');
    for (const row of tables.rows) console.log(`- ${row.table_name}`);

    for (const table of [
      'users',
      'classes',
      'activities',
      'submissions',
      'logbooks',
      'ai_declarations',
      'valuations',
      'enrollments',
      'rubrics',
      'notifications',
    ]) {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM public."${table}"`);
      console.log(`${table}: ${result.rows[0].count}`);
    }
  } finally {
    await client.end();
  }
}

void verify().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
