#!/usr/bin/env node
/**
 * Do the migrations actually build the schema the entities expect?
 *
 * WHY THIS EXISTS
 * Twice now a feature has shipped an @Entity with no migration to create its
 * table. Development runs with `synchronize: true`, so TypeORM built the table
 * locally and every gate — lint, types, 279 unit tests, 135 end-to-end tests —
 * passed against a schema the migrations had never produced. Production runs
 * with `synchronize: false`, so it had no table at all. The tests could not
 * catch it because they were standing on the very mechanism that was hiding it.
 *
 * WHAT IT CHECKS, AND WHAT IT DELIBERATELY IGNORES
 * It runs the migrations against an empty database and then asks TypeORM what
 * it would still change to match the entities. Most of that answer is noise:
 * TypeORM wants to rename every explicitly-named index and constraint to its
 * own hashed name, which is 51 lines of difference that mean nothing. Failing
 * on those would make this check red on every run, and a check that is always
 * red is turned off within a week.
 *
 * So it fails on four patterns only, the ones that mean a table or column is
 * genuinely missing or genuinely extra:
 *
 *   CREATE TABLE …            an entity has no table
 *   DROP TABLE …              a table nothing maps to
 *   ALTER TABLE … ADD "col"   an entity property has no column
 *   ALTER TABLE … DROP COLUMN a column nothing maps to
 *
 * Index and constraint naming, defaults, and type widths are left alone.
 */
import { execSync } from 'node:child_process';
import pg from 'pg';

const DATA_SOURCE = 'dist/infrastructure/database/data-source.js';

/** Statements that mean the schema and the entities genuinely disagree. */
const STRUCTURAL = [
  { name: 'missing table', re: /^\s*CREATE TABLE/im },
  { name: 'unmapped table', re: /^\s*DROP TABLE/im },
  // `ADD "col"` — a quoted identifier, which distinguishes a missing column
  // from `ADD CONSTRAINT`, the rename noise this check exists to tolerate.
  { name: 'missing column', re: /ALTER TABLE\s+"[^"]+"\s+ADD\s+"/i },
  { name: 'unmapped column', re: /ALTER TABLE\s+"[^"]+"\s+DROP COLUMN/i },
];

// One command string, run through the shell, because npx on Windows is a
// shim rather than an executable. No user input reaches this.
const run = (args) =>
  execSync(['npx', ...args].join(' '), {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

// ── 1. The database must be EMPTY ────────────────────────────────────
// Without this the check can pass by accident: run it against a database
// somebody already migrated by hand and it proves nothing at all, quietly.
// That is the same shape as the bug it is here to catch, so it is refused.
// Asked over pg rather than through `typeorm query`, whose CLI splits a SQL
// string on spaces once a shell is involved.
const client = new pg.Client({
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER ?? 'pathwise',
  password: process.env.POSTGRES_PASSWORD ?? 'pathwise_dev_password',
  database: process.env.POSTGRES_DB ?? 'pathwise',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

let tableCount;
try {
  await client.connect();
  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  tableCount = rows[0].n;
} catch (err) {
  fail(`Could not reach the database: ${err.message}`);
} finally {
  await client.end().catch(() => {});
}

if (tableCount !== 0) {
  fail(
    `This check needs an EMPTY database and found ${tableCount} table(s).\n` +
      `  Point it at a scratch database — otherwise it can pass without\n` +
      `  proving the migrations build anything.`,
  );
}
console.log('· database is empty');

// ── 2. Build the schema from migrations alone ────────────────────────
try {
  run(['typeorm', 'migration:run', '-d', DATA_SOURCE]);
} catch (err) {
  fail(`Migrations failed to run.\n${err.stdout ?? ''}${err.stderr ?? ''}`);
}
console.log('· migrations ran');

// ── 3. Ask what would still have to change ───────────────────────────
let log;
try {
  log = run(['typeorm', 'schema:log', '-d', DATA_SOURCE]);
} catch (err) {
  fail(`schema:log failed.\n${err.stdout ?? ''}${err.stderr ?? ''}`);
}

// TypeORM prints every query it issues while introspecting; those lines are
// its own reads, not proposed changes.
const proposed = log
  .split('\n')
  .filter((line) => !/^query:/.test(line.trim()))
  .filter((line) => line.trim().length > 0);

const problems = [];
for (const line of proposed) {
  for (const { name, re } of STRUCTURAL) {
    if (re.test(line)) problems.push(`  [${name}] ${line.trim()}`);
  }
}

if (problems.length > 0) {
  console.error(
    `\n✗ The migrations do not build the schema the entities describe.\n\n` +
      problems.join('\n') +
      `\n\n  An entity was added or changed without a migration to match.\n` +
      `  Write one in src/infrastructure/database/migrations/ — production\n` +
      `  runs with synchronize:false and will not create it for you.\n`,
  );
  process.exit(1);
}

console.log(
  `✓ migrations cover every entity ` +
    `(${proposed.length} cosmetic difference(s) ignored: index and constraint naming)`,
);
