import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { getTableColumns, getTableName, type Table } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sqliteSchema } from '../src/db/schema/sqlite';
import {
  listMigrationFiles,
  migrate,
  splitStatements,
  STATEMENT_BREAKPOINT,
} from '../src/db/migrate';
import { createTestDb, describeEachAdapter, expectDbError, type TestDb } from './adapters';

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

  it('ignores empty chunks and trailing breakpoints', () => {
    expect(
      splitStatements(`\n${STATEMENT_BREAKPOINT}\nSELECT 1;\n${STATEMENT_BREAKPOINT}\n`),
    ).toEqual(['SELECT 1;']);
    expect(splitStatements('')).toEqual([]);
  });

  it('keeps inline dashes that are not comments', () => {
    expect(splitStatements(`INSERT INTO t VALUES ('a--b');`)).toEqual([
      `INSERT INTO t VALUES ('a--b');`,
    ]);
  });
});

describe('listMigrationFiles', () => {
  it('returns only .sql files in lexical order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bookguardian-migrations-'));
    try {
      for (const name of ['0002_b.sql', 'README.md', '0001_a.sql', '0010_c.sql']) {
        writeFileSync(join(dir, name), '');
      }
      expect(listMigrationFiles(dir)).toEqual(['0001_a.sql', '0002_b.sql', '0010_c.sql']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('migrate (sqlite file inspection)', () => {
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

  it('creates the declared indexes', () => {
    const raw = new Database(db.path, { readonly: true });
    try {
      const indexes = (
        raw
          .prepare(
            `SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'`,
          )
          .all() as { name: string }[]
      )
        .map((r) => r.name)
        .sort();
      expect(indexes).toEqual([
        'idx_books_isbn13',
        'idx_books_owner',
        'idx_books_shelf',
        'idx_lendings_book',
        'idx_lendings_open',
        'idx_libraries_owner',
        'idx_library_shares_grantee',
        'idx_shelves_library',
      ]);
      // The UNIQUE constraint becomes an sqlite autoindex on (library_id, grantee_id).
      const unique = (
        raw.pragma('index_list(library_shares)') as { name: string; origin: string }[]
      ).filter((i) => i.origin === 'u'); // 'u' = UNIQUE constraint, 'pk' = primary key
      expect(unique).toHaveLength(1);
      const cols = (raw.pragma(`index_info(${unique[0]!.name})`) as { name: string }[]).map(
        (c) => c.name,
      );
      expect(cols).toEqual(['library_id', 'grantee_id']);
    } finally {
      raw.close();
    }
  });
});

describeEachAdapter('migrate', (adapterCase) => {
  let db: TestDb;
  beforeEach(async () => {
    db = await adapterCase.create();
  });
  afterEach(async () => {
    await db.cleanup();
  });

  it('records applied files and is idempotent', async () => {
    const { kit, tables } = db.adapter;
    const applied = await kit.select(tables.schemaMigrations);
    expect(applied.map((r) => r.name)).toEqual(listMigrationFiles());
    expect(applied.every((r) => !Number.isNaN(Date.parse(r.appliedAt)))).toBe(true);

    const second = await migrate(db.adapter);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(listMigrationFiles());
  });

  it('applies only files that are not yet recorded', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bookguardian-extra-'));
    try {
      writeFileSync(
        join(dir, '9999_extra.sql'),
        `CREATE TABLE zz_extra (id VARCHAR(36) NOT NULL, PRIMARY KEY (id));\n${STATEMENT_BREAKPOINT}\nCREATE INDEX idx_zz_extra ON zz_extra (id);\n`,
      );
      const first = await migrate(db.adapter, dir);
      expect(first).toEqual({ applied: ['9999_extra.sql'], skipped: [] });
      const second = await migrate(db.adapter, dir);
      expect(second).toEqual({ applied: [], skipped: ['9999_extra.sql'] });
    } finally {
      await db.adapter.kit.execute('DROP TABLE IF EXISTS zz_extra');
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('enforces foreign keys', async () => {
    const { kit, tables } = db.adapter;
    await expectDbError(
      kit.insert(tables.libraries, {
        id: '0f3e2b8a-7d3c-4b2f-9a11-6f5e4d3c2b1a',
        ownerId: '00000000-0000-4000-8000-000000000000',
        name: 'x',
        location: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      /foreign key/i,
    );
  });

  it('pings', async () => {
    expect(await db.adapter.ping()).toBe(true);
  });
});
