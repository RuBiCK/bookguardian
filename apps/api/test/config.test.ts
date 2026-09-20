import { resolve } from 'node:path';
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
        catalogRefreshMs: 180 * 86_400_000,
        catalogMissMs: 7 * 86_400_000,
      },
      covers: {
        dir: resolve('./data/covers'),
        openLibraryUrl: 'https://openlibrary.org',
        openLibraryCoversUrl: 'https://covers.openlibrary.org',
        googleBooksUrl: 'https://www.googleapis.com/books/v1',
        googleBooksApiKey: undefined,
        timeoutMs: 8000,
        missMs: 30 * 86_400_000,
        gcSharedAfterMs: 90 * 86_400_000,
        minIntervalMs: 1000,
      },
      webDist: undefined,
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
      CATALOG_REFRESH_DAYS: '30',
      CATALOG_MISS_DAYS: '1',
      COVERS_DIR: '/srv/covers',
      OPEN_LIBRARY_COVERS_URL: 'http://localhost:9997',
      COVERS_MISS_DAYS: '3',
      COVERS_GC_DAYS: '10',
      COVERS_MIN_INTERVAL_MS: '0',
      WEB_DIST: '/srv/web',
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
        catalogRefreshMs: 30 * 86_400_000,
        catalogMissMs: 86_400_000,
      },
      covers: {
        dir: '/srv/covers',
        openLibraryUrl: 'http://localhost:9999',
        openLibraryCoversUrl: 'http://localhost:9997',
        googleBooksUrl: 'http://localhost:9998/books',
        googleBooksApiKey: 'secret',
        timeoutMs: 2000,
        missMs: 3 * 86_400_000,
        gcSharedAfterMs: 10 * 86_400_000,
        minIntervalMs: 0,
      },
      webDist: '/srv/web',
    });
  });

  it('keeps covers next to the SQLite file unless COVERS_DIR says otherwise', () => {
    expect(loadConfig({ DATABASE_PATH: '/data/bookguardian.db' }).covers.dir).toBe('/data/covers');
    expect(loadConfig({ COVERS_DIR: 'covers' }).covers.dir).toBe(resolve('covers'));
  });

  it('resolves a relative WEB_DIST against the working directory', () => {
    expect(loadConfig({ WEB_DIST: '../web/dist' }).webDist).toBe(resolve('../web/dist'));
  });

  it('rejects unknown drivers and invalid ports', () => {
    expect(() => loadConfig({ DB_DRIVER: 'oracle' })).toThrow(/DB_DRIVER/);
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/);
    expect(() => loadConfig({ OPEN_LIBRARY_URL: 'not a url' })).toThrow(/OPEN_LIBRARY_URL/);
    expect(() => loadConfig({ LOOKUP_TIMEOUT_MS: '1' })).toThrow(/LOOKUP_TIMEOUT_MS/);
    expect(() => loadConfig({ CATALOG_REFRESH_DAYS: '0' })).toThrow(/CATALOG_REFRESH_DAYS/);
    expect(() => loadConfig({ CATALOG_MISS_DAYS: '-1' })).toThrow(/CATALOG_MISS_DAYS/);
    expect(() => loadConfig({ COVERS_GC_DAYS: '-1' })).toThrow(/COVERS_GC_DAYS/);
  });
});
