// Read-only sanity check: connects through the shared pool, prints who and where
// we are connected, and confirms that key Subproject 1 objects exist.
// Run with: npm run db:check
import { pool } from '../db/pool.js';

const REQUIRED_TABLES = ['title_basic', 'app_user'];
const REQUIRED_FUNCTIONS = ['string_search'];

async function main(): Promise<boolean> {
  const identity = await pool.query<{ database: string; user: string; version: string }>(
    'SELECT current_database() AS database, current_user AS user, version() AS version',
  );
  const row = identity.rows[0];
  if (!row) {
    throw new Error('the identity query returned no row');
  }
  const { database, user, version } = row;
  console.log(`Connected to database "${database}" as user "${user}"`);
  console.log(`Server: ${version}`);

  // to_regclass returns NULL instead of failing when a table does not exist.
  const tables = await pool.query<{ name: string; found: boolean }>(
    'SELECT name, to_regclass(name) IS NOT NULL AS found FROM unnest($1::text[]) AS name',
    [REQUIRED_TABLES],
  );
  const functions = await pool.query<{ name: string; found: boolean }>(
    `SELECT name,
            EXISTS (SELECT 1 FROM pg_proc p
                    WHERE p.proname = name AND pg_function_is_visible(p.oid)) AS found
     FROM unnest($1::text[]) AS name`,
    [REQUIRED_FUNCTIONS],
  );

  let allFound = true;
  for (const [kind, rows] of [
    ['table', tables.rows],
    ['function', functions.rows],
  ] as const) {
    for (const { name, found } of rows) {
      console.log(`  ${found ? 'OK     ' : 'MISSING'} ${kind} ${name}`);
      allFound &&= found;
    }
  }
  return allFound;
}

try {
  const ok = await main();
  console.log(ok ? 'Database check passed.' : 'Database check failed: some objects are missing.');
  process.exitCode = ok ? 0 : 1;
} catch (error) {
  console.error('Database check failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
