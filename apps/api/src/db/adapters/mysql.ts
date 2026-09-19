/**
 * MySQL adapter — wired but not yet exercised by an automated test.
 * Set `DB_DRIVER=mysql` and `DATABASE_URL=mysql://…` to use it.
 */
import { count, sql, type Column, type SQL, type Table } from 'drizzle-orm';
import type { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { mysqlSchema } from '../schema/mysql';
import {
  likePattern,
  type DatabaseAdapter,
  type DialectKit,
  type InsertRow,
  type QueryOptions,
} from './types';

export interface MysqlAdapterOptions {
  url: string;
}

function createKit(db: MySql2Database): DialectKit {
  return {
    async select<T extends Table>(table: T, options: QueryOptions = {}) {
      let query = db
        .select()
        .from(table as unknown as MySqlTable)
        .where(options.where)
        .orderBy(...(options.orderBy ?? []))
        .$dynamic();
      if (options.limit !== undefined) query = query.limit(options.limit);
      if (options.offset !== undefined) query = query.offset(options.offset);
      return await query;
    },
    async count(table: Table, where?: SQL) {
      const [row] = await db
        .select({ value: count() })
        .from(table as unknown as MySqlTable)
        .where(where);
      return row?.value ?? 0;
    },
    async countBy(table: Table, column: Column, where?: SQL) {
      const rows = await db
        .select({ key: column as unknown as MySqlColumn, count: count() })
        .from(table as unknown as MySqlTable)
        .where(where)
        .groupBy(column as unknown as MySqlColumn);
      return rows.map((row) => ({ key: String(row.key), count: Number(row.count) }));
    },
    contains(column: Column, needle: string) {
      // MySQL's default LIKE escape character is already `\`.
      return sql`lower(${column}) like ${likePattern(needle)}`;
    },
    async insert<T extends Table>(table: T, values: InsertRow<T> | InsertRow<T>[]) {
      const rows = Array.isArray(values) ? values : [values];
      if (rows.length === 0) return;
      await db.insert(table as unknown as MySqlTable).values(rows);
    },
    async update<T extends Table>(table: T, values: Partial<InsertRow<T>>, where: SQL) {
      await db
        .update(table as unknown as MySqlTable)
        .set(values)
        .where(where);
    },
    async delete<T extends Table>(table: T, where: SQL) {
      await db.delete(table as unknown as MySqlTable).where(where);
    },
    async execute(statement: string) {
      await db.execute(sql.raw(statement));
    },
    async transaction<R>(fn: (tx: DialectKit) => Promise<R>): Promise<R> {
      return db.transaction((tx) => fn(createKit(tx as unknown as MySql2Database)));
    },
  };
}

export function createMysqlAdapter(options: MysqlAdapterOptions): DatabaseAdapter {
  const pool = mysql.createPool({ uri: options.url, connectionLimit: 10 });
  const db = drizzle(pool);

  return {
    driver: 'mysql',
    tables: mysqlSchema,
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
      await pool.end();
    },
  };
}
