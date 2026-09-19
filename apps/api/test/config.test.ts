import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('applies defaults when nothing is set', () => {
    const config = loadConfig({});
    expect(config).toEqual({
      env: 'development',
      port: 3000,
      db: { driver: 'sqlite', sqlitePath: './data/bookguardian.db', url: undefined },
      lookup: {
        openLibraryUrl: 'https://openlibrary.org',
        googleBooksUrl: 'https://www.googleapis.com/books/v1',
        googleBooksApiKey: undefined,
        timeoutMs: 8000,
        cacheTtlMs: 86_400_000,
      },
    });
  });

  it('reads and coerces values from the environment', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      DB_DRIVER: 'postgres',
      DATABASE_URL: 'postgres://u:p@h:5432/db',
      DATABASE_PATH: '/tmp/x.db',
      OPEN_LIBRARY_URL: 'http://localhost:9999',
      GOOGLE_BOOKS_URL: 'http://localhost:9998/books',
      GOOGLE_BOOKS_API_KEY: 'secret',
      LOOKUP_TIMEOUT_MS: '2000',
      LOOKUP_CACHE_TTL_SECONDS: '60',
    });
    expect(config).toEqual({
      env: 'production',
      port: 8080,
      db: { driver: 'postgres', sqlitePath: '/tmp/x.db', url: 'postgres://u:p@h:5432/db' },
      lookup: {
        openLibraryUrl: 'http://localhost:9999',
        googleBooksUrl: 'http://localhost:9998/books',
        googleBooksApiKey: 'secret',
        timeoutMs: 2000,
        cacheTtlMs: 60_000,
      },
    });
  });

  it('rejects unknown drivers and invalid ports', () => {
    expect(() => loadConfig({ DB_DRIVER: 'oracle' })).toThrow(/DB_DRIVER/);
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/);
    expect(() => loadConfig({ OPEN_LIBRARY_URL: 'not a url' })).toThrow(/OPEN_LIBRARY_URL/);
    expect(() => loadConfig({ LOOKUP_TIMEOUT_MS: '1' })).toThrow(/LOOKUP_TIMEOUT_MS/);
  });
});
