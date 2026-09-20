/**
 * Shared harness for API integration tests: a migrated + seeded SQLite
 * database behind a quiet Hono app, plus tiny JSON helpers.
 */
import { createApp, type App, type AuthAppOptions } from '../src/app';
import { createSessionService, SESSION_COOKIE } from '../src/auth';
import { createRepositories, type Repositories } from '../src/db/repositories';
import { seedLocalUser, type SeedResult } from '../src/db/seed';
import { createTestDb, type TestDb } from './adapters';
import { fixtureCovers, type FixtureCovers, type FixtureCoversOptions } from './cover-fixtures';
import { fixtureLookup, type FixtureLookupOptions } from './lookup-fixtures';

/** Requests carrying this header act as that user (see `resolveOwner` in `app.ts`). */
export const OWNER_HEADER = 'x-test-owner';

/** A cookie header string for a fresh session of `userId` (see `loginAs`). */
export interface TestLogin {
  token: string;
  cookie: string;
}

export interface TestApp {
  app: App;
  db: TestDb;
  repos: Repositories;
  base: SeedResult;
  /** Recorded-fixture metadata lookup (see `lookup-fixtures.ts`). */
  lookup: ReturnType<typeof fixtureLookup>;
  /** Cover cascade over fixtures, files in a temp dir (see `cover-fixtures.ts`). */
  covers: FixtureCovers;
  /** Start a real database session for a user; send `cookie` as the `Cookie` header. */
  loginAs(this: void, userId: string): Promise<TestLogin>;
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
  /**
   * Require a session like production does: requests without `x-test-owner`
   * go through the `bg_session` cookie instead of acting as the seeded user.
   */
  sessionAuth?: boolean;
  auth?: AuthAppOptions;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const db = options.db ?? (await createTestDb());
  const repos = createRepositories(db.adapter);
  const base = await seedLocalUser(db.adapter);
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
    auth: { env: 'test', ...options.auth },
    resolveOwner: options.sessionAuth
      ? async (c) => c.req.header(OWNER_HEADER)
      : async (c) => c.req.header(OWNER_HEADER) ?? base.userId,
  });
  const sessions = createSessionService({ repos, now: options.auth?.now });
  return {
    app,
    db,
    repos,
    base,
    lookup,
    covers,
    async loginAs(userId) {
      const { token } = await sessions.create(userId, 'vitest');
      return { token, cookie: `${SESSION_COOKIE}=${token}` };
    },
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
  cookie?: string,
): Promise<JsonResponse<T>> {
  const res = await app.request(path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie === undefined ? {} : { cookie }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T };
}

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export const MISSING_ID = '00000000-0000-4000-8000-000000000000';
