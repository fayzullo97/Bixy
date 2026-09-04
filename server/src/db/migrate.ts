import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * Applies the SQL files in ./migrations in filename order against the Supabase
 * Postgres database. Uses a direct Postgres connection (SUPABASE_DB_URL) because
 * DDL cannot go through the PostgREST/service-role API — that only touches
 * existing tables. Idempotent: every migration uses `create table if not exists`.
 */
async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error(
      'SUPABASE_DB_URL is not set.\n' +
        'Get it from Supabase → Settings → Database → Connection string → URI ' +
        '(it contains the DB password), then add it to server/.env.\n' +
        'Alternatively, paste server/src/db/migrations/0001_init.sql into the Supabase SQL editor.',
    );
    process.exit(1);
  }

  const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    for (const file of files) {
      process.stdout.write(`applying ${file} ... `);
      await client.query(readFileSync(join(dir, file), 'utf8'));
      console.log('ok');
    }
    console.log(`\n${files.length} migration(s) applied.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
