import type { Column, SQL, Table } from 'drizzle-orm';
import type { DbDriver } from '@bookguardian/shared';
import type { Tables } from '../schema';

/** Row type of a table as returned by SELECT. */
export type SelectRow<T extends Table> = T['$inferSelect'];
/** Row type accepted by INSERT. */
export type InsertRow<T extends Table> = T['$inferInsert'];

export interface QueryOptions {
  where?: SQL;
  orderBy?: SQL[];
  limit?: number;
  offset?: number;
}

/** One row of a grouped count: the grouping column's value and how many rows share it. */
export interface GroupCount {
  key: string;
  count: number;
}

/**
 * The tiny dialect-neutral surface that repositories are written against.
 *
 * Each adapter implements it with its own Drizzle dialect (`sqlite.ts`,
 * `postgres.ts`, `mysql.ts`). Repositories never touch a driver or a dialect
 * specific query builder directly, and never contain raw SQL.
 */
export interface DialectKit {
  select<T extends Table>(table: T, options?: QueryOptions): Promise<SelectRow<T>[]>;
  /** `SELECT count(*)` with an optional filter. */
  count(table: Table, where?: SQL): Promise<number>;
  /** `SELECT column, count(*) … GROUP BY column`; keys are stringified column values. */
  countBy(table: Table, column: Column, where?: SQL): Promise<GroupCount[]>;
  /**
   * Case-insensitive substring match on a text column, safe to feed user
   * input (`%`, `_` and `\` in `needle` are matched literally).
   */
  contains(column: Column, needle: string): SQL;
  insert<T extends Table>(table: T, values: InsertRow<T> | InsertRow<T>[]): Promise<void>;
  update<T extends Table>(table: T, values: Partial<InsertRow<T>>, where: SQL): Promise<void>;
  delete<T extends Table>(table: T, where: SQL): Promise<void>;
  /** Execute one DDL statement. Only used by the migration runner. */
  execute(statement: string): Promise<void>;
  /** Run `fn` inside a transaction (best effort: SQLite/PG/MySQL all support it). */
  transaction<R>(fn: (tx: DialectKit) => Promise<R>): Promise<R>;
}

export interface DatabaseAdapter {
  readonly driver: DbDriver;
  readonly tables: Tables;
  readonly kit: DialectKit;
  /** Cheap round-trip used by the health endpoint. */
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

/** Turn a user-supplied needle into a `%needle%` LIKE pattern, escaping wildcards with `\`. */
export function likePattern(needle: string): string {
  return `%${needle.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}
