import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { sql, type SQL, type Table } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sqliteSchema } from '../schema/sqlite';
import type { DatabaseAdapter, DialectKit, InsertRow, QueryOptions } from './types';

export interface SqliteAdapterOptions {
  /** File path, or `:memory:` for an ephemeral database (tests). */
  path: string;
}

function createKit(db: BetterSQLite3Database): DialectKit {
  return {
    async select<T extends Table>(table: T, options: QueryOptions = {}) {
      const query = db
        .select()
        .from(table)
        .where(options.where)
        .orderBy(...(options.orderBy ?? []))
        .limit(options.limit ?? -1)
        .offset(options.offset ?? 0);
      return await query;
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
      db.run(sql.raw(statement));
    },
    async transaction<R>(fn: (tx: DialectKit) => Promise<R>): Promise<R> {
      // better-sqlite3 transactions are synchronous; drizzle's async wrapper
      // would deadlock on awaited promises, so emulate with SAVEPOINT-free
      // BEGIN/COMMIT around the async callback.
      db.run(sql.raw('BEGIN'));
      try {
        const result = await fn(createKit(db));
        db.run(sql.raw('COMMIT'));
        return result;
      } catch (error) {
        db.run(sql.raw('ROLLBACK'));
        throw error;
      }
    },
  };
}

export function createSqliteAdapter(options: SqliteAdapterOptions): DatabaseAdapter {
  if (options.path !== ':memory:') {
    mkdirSync(dirname(options.path), { recursive: true });
  }
  const client = new Database(options.path);
  client.pragma('journal_mode = WAL');
  client.pragma('foreign_keys = ON');
  const db = drizzle(client);

  return {
    driver: 'sqlite',
    tables: sqliteSchema,
    kit: createKit(db),
    async ping() {
      try {
        db.get(sql`select 1`);
        return true;
      } catch {
        return false;
      }
    },
    async close() {
      client.close();
    },
  };
}
