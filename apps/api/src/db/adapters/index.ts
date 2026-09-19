import type { DbConfig } from '../../config';
import { createMysqlAdapter } from './mysql';
import { createPostgresAdapter } from './postgres';
import { createSqliteAdapter } from './sqlite';
import type { DatabaseAdapter } from './types';

export type { DatabaseAdapter, DialectKit } from './types';

/**
 * Build the adapter selected by `DB_DRIVER`. This is the single place where
 * the application learns which database engine it is talking to.
 */
export function createAdapter(config: DbConfig): DatabaseAdapter {
  switch (config.driver) {
    case 'sqlite':
      return createSqliteAdapter({ path: config.sqlitePath });
    case 'postgres':
      return createPostgresAdapter({ url: requireUrl(config, 'postgres') });
    case 'mysql':
      return createMysqlAdapter({ url: requireUrl(config, 'mysql') });
  }
}

function requireUrl(config: DbConfig, driver: string): string {
  if (!config.url) {
    throw new Error(`DATABASE_URL is required when DB_DRIVER=${driver}`);
  }
  return config.url;
}
