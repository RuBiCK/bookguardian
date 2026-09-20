/**
 * Shared harness for API integration tests: a migrated + seeded SQLite
 * database behind a quiet Hono app, plus tiny JSON helpers.
 */
import { createApp, type App } from '../src/app';
import { createRepositories, type Repositories } from '../src/db/repositories';
import { seed, type SeedResult } from '../src/db/seed';
import { createTestDb, type TestDb } from './adapters';
import { fixtureCovers, type FixtureCovers, type FixtureCoversOptions } from './cover-fixtures';
import { fixtureLookup, type FixtureLookupOptions } from './lookup-fixtures';

/** Requests carrying this header act as that user (see `resolveOwner` in `app.ts`). */
export const OWNER_HEADER = 'x-test-owner';

export interface TestApp {
  app: App;
  db: TestDb;
  repos: Repositories;
  base: SeedResult;
  /** Recorded-fixture metadata lookup (see `lookup-fixtures.ts`). */
  lookup: ReturnType<typeof fixtureLookup>;
  /** Cover cascade over fixtures, files in a temp dir (see `cover-fixtures.ts`). */
  covers: FixtureCovers;
  cleanup(this: void): Promise<void>;
}

export interface TestAppOptions {
  /** Also serve a built SPA from this directory (see `src/web-app.ts`). */
  webDist?: string;
  /** Reuse a database (simulates a restart on the same SQLite file). */
  db?: TestDb;
  /** Clock / cadence for the catalogue-backed lookup. */
  lookup?: Pick<FixtureLookupOptions, 'now' | 'refreshMs' | 'missMs'>;
  covers?: FixtureCoversOptions;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const db = options.db ?? (await createTestDb());
  const repos = createRepositories(db.adapter);
  const base = await seed(db.adapter);
  const lookup = fixtureLookup({ ...options.lookup, catalog: repos.catalogBooks });
  const covers = fixtureCovers(repos, options.covers);
  const app = createApp({
    quiet: true,
    webDist: options.webDist,
    services: {
      adapter: db.adapter,
      repos,
      lookup: lookup.service,
      covers: covers.service,
      version: '0.0.0-test',
    },
    resolveOwner: async (c) => c.req.header(OWNER_HEADER),
  });
  return {
    app,
    db,
    repos,
    base,
    lookup,
    covers,
    async cleanup() {
      await covers.service.close();
      covers.cleanup();
      await db.cleanup();
    },
  };
}

export interface JsonResponse<T = unknown> {
  status: number;
  body: T;
}

/** Fire a request with an optional JSON body and parse the JSON reply (if any). */
export async function json<T = unknown>(
  app: App,
  method: string,
  path: string,
  body?: unknown,
): Promise<JsonResponse<T>> {
  const res = await app.request(path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T };
}

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export const MISSING_ID = '00000000-0000-4000-8000-000000000000';
