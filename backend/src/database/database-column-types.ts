import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

// Entity decorators are evaluated before Nest's ConfigModule is initialized.
// Load the local environment here so date columns can use the correct driver type.
const runningTests = Boolean(process.env.JEST_WORKER_ID) || process.env.NODE_ENV === 'test';
if (!runningTests) {
  const envPath = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')].find(
    (candidate) => existsSync(candidate),
  );
  if (envPath) loadEnv({ path: envPath, override: false });
}

export const dateColumnType: 'datetime' | 'timestamp' =
  !runningTests && process.env.DATABASE_URL && process.env.DATABASE_PATH !== ':memory:'
    ? 'timestamp'
    : 'datetime';
