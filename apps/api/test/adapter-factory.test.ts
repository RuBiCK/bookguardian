import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAdapter } from '../src/db/adapters';
import { migrate } from '../src/db/migrate';

describe('createAdapter', () => {
  it('builds a working sqlite adapter and creates the data directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bookguardian-factory-'));
    const adapter = createAdapter({ driver: 'sqlite', sqlitePath: join(dir, 'nested/dir/x.db') });
    try {
      expect(adapter.driver).toBe('sqlite');
      await migrate(adapter);
      expect(await adapter.ping()).toBe(true);
    } finally {
      await adapter.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires DATABASE_URL for postgres and mysql', () => {
    expect(() => createAdapter({ driver: 'postgres', sqlitePath: '' })).toThrow(
      'DATABASE_URL is required when DB_DRIVER=postgres',
    );
    expect(() => createAdapter({ driver: 'mysql', sqlitePath: '' })).toThrow(
      'DATABASE_URL is required when DB_DRIVER=mysql',
    );
  });

  it('constructs postgres and mysql adapters lazily (no connection until used)', async () => {
    const pg = createAdapter({
      driver: 'postgres',
      sqlitePath: '',
      url: 'postgres://u:p@127.0.0.1:1/db',
    });
    const my = createAdapter({
      driver: 'mysql',
      sqlitePath: '',
      url: 'mysql://u:p@127.0.0.1:1/db',
    });
    expect(pg.driver).toBe('postgres');
    expect(my.driver).toBe('mysql');
    expect(Object.keys(pg.tables).sort()).toEqual(Object.keys(my.tables).sort());
    expect(await pg.ping()).toBe(false);
    expect(await my.ping()).toBe(false);
    await pg.close();
    await my.close();
  });
});
