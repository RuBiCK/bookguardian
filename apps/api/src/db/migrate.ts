/**
 * Migration runner shared by every dialect.
 *
 * Reads `drizzle/migrations/*.sql` in lexical order, splits each file on the
 * `--> statement-breakpoint` marker and executes the statements through the
 * adapter's `execute`. Applied files are recorded in `schema_migrations` so the
 * runner is idempotent.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { asc } from 'drizzle-orm';
import type { DatabaseAdapter } from './adapters';

export const STATEMENT_BREAKPOINT = '--> statement-breakpoint';

/**
 * Locate `apps/api/drizzle/migrations` whether this module runs from `src/`
 * (tsx) or from the bundled `dist/` output.
 */
function findMigrationsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../drizzle/migrations'),
    resolve(here, '../drizzle/migrations'),
    resolve(process.cwd(), 'drizzle/migrations'),
  ];
  const found = candidates.find((dir) => existsSync(dir));
  if (!found) throw new Error(`Cannot find migrations dir; tried ${candidates.join(', ')}`);
  return found;
}

const MIGRATIONS_DIR = findMigrationsDir();

export function splitStatements(sqlText: string): string[] {
  return sqlText
    .split(STATEMENT_BREAKPOINT)
    .map((chunk) =>
      chunk
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

export function listMigrationFiles(dir: string = MIGRATIONS_DIR): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

export interface MigrateResult {
  applied: string[];
  skipped: string[];
}

export async function migrate(
  adapter: DatabaseAdapter,
  dir: string = MIGRATIONS_DIR,
): Promise<MigrateResult> {
  const { kit, tables } = adapter;
  await kit.execute(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) NOT NULL, applied_at VARCHAR(32) NOT NULL, PRIMARY KEY (name))',
  );

  const done = new Set(
    (
      await kit.select(tables.schemaMigrations, { orderBy: [asc(tables.schemaMigrations.name)] })
    ).map((row) => row.name),
  );

  const result: MigrateResult = { applied: [], skipped: [] };
  for (const file of listMigrationFiles(dir)) {
    if (done.has(file)) {
      result.skipped.push(file);
      continue;
    }
    const statements = splitStatements(readFileSync(join(dir, file), 'utf8'));
    for (const statement of statements) {
      await kit.execute(statement);
    }
    await kit.insert(tables.schemaMigrations, {
      name: file,
      appliedAt: new Date().toISOString(),
    });
    result.applied.push(file);
  }
  return result;
}
