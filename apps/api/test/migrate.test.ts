import Database from 'better-sqlite3';
import { getTableColumns, getTableName, type Table } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sqliteSchema } from '../src/db/schema/sqlite';
import { migrate, splitStatements, STATEMENT_BREAKPOINT } from '../src/db/migrate';
import { createTestDb, type TestDb } from './helpers';

function columnNames(table: Table): string[] {
  return Object.values(getTableColumns(table))
    .map((c) => c.name)
    .sort();
}

describe('splitStatements', () => {
  it('splits on the breakpoint marker and drops comment lines', () => {
    const input = `-- header\nCREATE TABLE a (id INT);\n${STATEMENT_BREAKPOINT}\n-- note\nCREATE TABLE b (id INT);\n`;
    expect(splitStatements(input)).toEqual([
      'CREATE TABLE a (id INT);',
      'CREATE TABLE b (id INT);',
    ]);
  });
});

describe('migrate (sqlite)', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.cleanup();
  });

  it('creates every table declared in the drizzle schema with matching columns', () => {
    const raw = new Database(db.path, { readonly: true });
    try {
      for (const table of Object.values(sqliteSchema)) {
        const name = getTableName(table);
        const actual = (raw.pragma(`table_info(${name})`) as { name: string }[])
          .map((c) => c.name)
          .sort();
        expect(actual, `columns of ${name}`).toEqual(columnNames(table));
      }
    } finally {
      raw.close();
    }
  });

  it('is idempotent', async () => {
    const second = await migrate(db.adapter);
    expect(second.applied).toEqual([]);
    expect(second.skipped.length).toBeGreaterThan(0);
  });

  it('enforces foreign keys', async () => {
    const { kit, tables } = db.adapter;
    await expect(
      kit.insert(tables.libraries, {
        id: 'lib-1',
        ownerId: 'missing-user',
        name: 'x',
        location: null,
        createdAt: 'now',
        updatedAt: 'now',
      }),
    ).rejects.toThrow(/FOREIGN KEY/);
  });
});
