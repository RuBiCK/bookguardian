/**
 * Shared harness for API integration tests: a migrated + seeded SQLite
 * database behind a quiet Hono app, plus tiny JSON helpers.
 */
import { createApp, type App } from '../src/app';
import { createRepositories, type Repositories } from '../src/db/repositories';
import { seed, type SeedResult } from '../src/db/seed';
import { createTestDb, type TestDb } from './adapters';
import { fixtureLookup } from './lookup-fixtures';

export interface TestApp {
  app: App;
  db: TestDb;
  repos: Repositories;
  base: SeedResult;
  /** Recorded-fixture metadata lookup (see `lookup-fixtures.ts`). */
  lookup: ReturnType<typeof fixtureLookup>;
  cleanup(this: void): Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const db = await createTestDb();
  const repos = createRepositories(db.adapter);
  const base = await seed(db.adapter);
  const lookup = fixtureLookup();
  const app = createApp({
    quiet: true,
    services: { adapter: db.adapter, repos, lookup: lookup.service, version: '0.0.0-test' },
  });
  return { app, db, repos, base, lookup, cleanup: db.cleanup };
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
