import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('applies defaults when nothing is set', () => {
    const config = loadConfig({});
    expect(config).toEqual({
      env: 'development',
      port: 3000,
      db: { driver: 'sqlite', sqlitePath: './data/bookguardian.db', url: undefined },
    });
  });

  it('reads and coerces values from the environment', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      DB_DRIVER: 'postgres',
      DATABASE_URL: 'postgres://u:p@h:5432/db',
      DATABASE_PATH: '/tmp/x.db',
    });
    expect(config).toEqual({
      env: 'production',
      port: 8080,
      db: { driver: 'postgres', sqlitePath: '/tmp/x.db', url: 'postgres://u:p@h:5432/db' },
    });
  });

  it('rejects unknown drivers and invalid ports', () => {
    expect(() => loadConfig({ DB_DRIVER: 'oracle' })).toThrow(/DB_DRIVER/);
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/);
  });
});
