const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL no está configurada');
}

const sqlPath = path.resolve(__dirname, '..', 'sql', 'enable-rls.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query(sql);

  const result = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = true
      AND tablename <> 'spatial_ref_sys'
    ORDER BY tablename
  `);

  console.log(`RLS habilitado en ${result.rowCount} tablas públicas.`);
  console.log(result.rows.map(({ tablename }) => tablename).join(', '));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
