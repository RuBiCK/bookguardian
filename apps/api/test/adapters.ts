/**
 * Test helpers that run a suite against every database adapter available in
 * the environment. SQLite always runs (temp file). Postgres and MySQL run only
 * when `TEST_POSTGRES_URL` / `TEST_MYSQL_URL` point at disposable databases —
 * dormant until that milestone is picked up; CI does not set them.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTableName, type Table } from 'drizzle-orm';
import { describe } from 'vitest';
import type { DbDriver } from '@bookguardian/shared';
import { createMysqlAdapter } from '../src/db/adapters/mysql';
import { createPostgresAdapter } from '../src/db/adapters/postgres';
import { createSqliteAdapter } from '../src/db/adapters/sqlite';
import type { DatabaseAdapter } from '../src/db/adapters/types';
import { migrate } from '../src/db/migrate';

export interface TestDb {
  adapter: DatabaseAdapter;
  /** SQLite file path (only for the sqlite driver). */
  path?: string;
  cleanup(this: void): Promise<void>;
}

export interface AdapterCase {
  driver: DbDriver;
  /** Fresh, migrated, empty database. */
  create(this: void): Promise<TestDb>;
}

/** Test-only DDL: wipe every table so each test starts from an empty schema. */
async function dropAllTables(adapter: DatabaseAdapter): Promise<void> {
  const { kit, tables, driver } = adapter;
  const names = Object.values(tables).map((t: Table) => getTableName(t));
  if (driver === 'mysql') await kit.execute('SET FOREIGN_KEY_CHECKS = 0');
  for (const name of names) {
    await kit.execute(`DROP TABLE IF EXISTS ${name}${driver === 'postgres' ? ' CASCADE' : ''}`);
  }
  if (driver === 'mysql') await kit.execute('SET FOREIGN_KEY_CHECKS = 1');
}

export const sqliteCase: AdapterCase = {
  driver: 'sqlite',
  async create() {
    const dir = mkdtempSync(join(tmpdir(), 'bookguardian-'));
    const path = join(dir, 'test.db');
    const adapter = createSqliteAdapter({ path });
    await migrate(adapter);
    return {
      adapter,
      path,
      async cleanup() {
        await adapter.close();
        rmSync(dir, { recursive: true, force: true });
      },
    };
  },
};

function serverCase(driver: 'postgres' | 'mysql', url: string): AdapterCase {
  return {
    driver,
    async create() {
      const adapter =
        driver === 'postgres' ? createPostgresAdapter({ url }) : createMysqlAdapter({ url });
      await dropAllTables(adapter);
      await migrate(adapter);
      return {
        adapter,
        async cleanup() {
          await adapter.close();
        },
      };
    },
  };
}

export const adapterCases: AdapterCase[] = [
  sqliteCase,
  ...(process.env.TEST_POSTGRES_URL ? [serverCase('postgres', process.env.TEST_POSTGRES_URL)] : []),
  ...(process.env.TEST_MYSQL_URL ? [serverCase('mysql', process.env.TEST_MYSQL_URL)] : []),
];

/** `describe` once per available adapter; the callback receives the case. */
export function describeEachAdapter(title: string, fn: (adapterCase: AdapterCase) => void) {
  for (const adapterCase of adapterCases) {
    describe(`${title} [${adapterCase.driver}]`, () => fn(adapterCase));
  }
}

/** Kept for tests that only make sense on SQLite (file inspection). */
export const createTestDb = sqliteCase.create;

/**
 * Drizzle wraps driver errors as `Failed query: …` with the driver error in
 * `cause` (Postgres/MySQL) while better-sqlite3 throws the raw error. Match a
 * constraint pattern against whichever message carries it.
 */
export async function expectDbError(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  let thrown: unknown;
  try {
    await promise;
  } catch (error) {
    thrown = error;
  }
  if (thrown === undefined) throw new Error('expected the database call to reject');
  const messages: string[] = [];
  for (let e: unknown = thrown; e instanceof Error; e = e.cause) messages.push(e.message);
  if (!messages.some((m) => pattern.test(m))) {
    throw new Error(`expected an error matching ${pattern}, got: ${messages.join(' <- ')}`);
  }
}
