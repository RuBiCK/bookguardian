import type { mysqlSchema } from './mysql';
import type { postgresSchema } from './postgres';
import type { sqliteSchema } from './sqlite';

/**
 * Union of the three dialect schemas. Property names and row shapes are
 * identical across dialects, so code written against `Tables` works with
 * whichever adapter is active.
 */
export type Tables = typeof sqliteSchema | typeof postgresSchema | typeof mysqlSchema;

export type TableName = keyof Tables;
