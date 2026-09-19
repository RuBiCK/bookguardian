import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { mysqlSchema } from '../src/db/schema/mysql';
import { postgresSchema } from '../src/db/schema/postgres';
import { sqliteSchema } from '../src/db/schema/sqlite';

type AnySchema = Record<string, Parameters<typeof getTableColumns>[0]>;

function shape(schema: AnySchema) {
  return Object.fromEntries(
    Object.entries(schema).map(([key, table]) => [
      key,
      {
        table: getTableName(table),
        columns: Object.fromEntries(
          Object.entries(getTableColumns(table)).map(([prop, col]) => [
            prop,
            { name: col.name, notNull: col.notNull, hasDefault: col.hasDefault },
          ]),
        ),
      },
    ]),
  );
}

describe('dialect schema parity', () => {
  it('sqlite, postgres and mysql declare the same tables and columns', () => {
    const sqlite = shape(sqliteSchema);
    expect(shape(postgresSchema as AnySchema)).toEqual(sqlite);
    expect(shape(mysqlSchema as AnySchema)).toEqual(sqlite);
  });

  it('every table in the drizzle schema is created by the initial migration', () => {
    const sql = readFileSync(resolve(__dirname, '../drizzle/migrations/0001_initial.sql'), 'utf8');
    for (const [key, table] of Object.entries(sqliteSchema)) {
      if (key === 'schemaMigrations') continue; // created by the runner itself
      expect(sql, `CREATE TABLE ${getTableName(table)}`).toMatch(
        new RegExp(`CREATE TABLE ${getTableName(table)} \\(`),
      );
      for (const col of Object.values(getTableColumns(table))) {
        expect(sql, `${getTableName(table)}.${col.name}`).toMatch(new RegExp(`\\b${col.name}\\b`));
      }
    }
  });
});
