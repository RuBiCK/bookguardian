/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion --
   tsc rejects pg-core's `.from()` with the generic `Table` constraint even
   though the lint rule considers the widening cast redundant. */
/**
 * Postgres adapter — wired but not yet exercised by an automated test.
 * Set `DB_DRIVER=postgres` and `DATABASE_URL=postgres://…` to use it.
 */
import { sql, type SQL, type Table } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { postgresSchema } from '../schema/postgres';
import type { DatabaseAdapter, DialectKit, InsertRow, QueryOptions, SelectRow } from './types';

export interface PostgresAdapterOptions {
  url: string;
}

function createKit(db: PostgresJsDatabase): DialectKit {
  return {
    async select<T extends Table>(table: T, options: QueryOptions = {}) {
      // pg-core's `.from()` rejects the generic `Table` constraint; the repositories
      // only ever pass tables from `postgresSchema`, so the widening is safe.
      let query = db
        .select()
        .from(table as unknown as PgTable)
        .where(options.where)
        .orderBy(...(options.orderBy ?? []))
        .$dynamic();
      if (options.limit !== undefined) query = query.limit(options.limit);
      if (options.offset !== undefined) query = query.offset(options.offset);
      return (await query) as SelectRow<T>[];
    },
    async insert<T extends Table>(table: T, values: InsertRow<T> | InsertRow<T>[]) {
      const rows = Array.isArray(values) ? values : [values];
      if (rows.length === 0) return;
      await db.insert(table).values(rows);
    },
    async update<T extends Table>(table: T, values: Partial<InsertRow<T>>, where: SQL) {
      await db.update(table).set(values).where(where);
    },
    async delete<T extends Table>(table: T, where: SQL) {
      await db.delete(table).where(where);
    },
    async execute(statement: string) {
      await db.execute(sql.raw(statement));
    },
    async transaction<R>(fn: (tx: DialectKit) => Promise<R>): Promise<R> {
      return db.transaction((tx) => fn(createKit(tx as unknown as PostgresJsDatabase)));
    },
  };
}

export function createPostgresAdapter(options: PostgresAdapterOptions): DatabaseAdapter {
  const client = postgres(options.url, { max: 10 });
  const db = drizzle(client);

  return {
    driver: 'postgres',
    tables: postgresSchema,
    kit: createKit(db),
    async ping() {
      try {
        await db.execute(sql`select 1`);
        return true;
      } catch {
        return false;
      }
    },
    async close() {
      await client.end();
    },
  };
}
