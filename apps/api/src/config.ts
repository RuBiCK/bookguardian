import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { dbDriverSchema } from '@bookguardian/shared';
import { parseAllowedEmails } from './auth/account';

// `.env` in the package directory wins over the repository root one.
loadDotenv({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  DB_DRIVER: dbDriverSchema.default('sqlite'),
  DATABASE_PATH: z.string().min(1).default('./data/bookguardian.db'),
  DATABASE_URL: z.string().min(1).optional(),
  // Book metadata lookup (Open Library first, Google Books fallback).
  OPEN_LIBRARY_URL: z.url().default('https://openlibrary.org'),
  GOOGLE_BOOKS_URL: z.url().default('https://www.googleapis.com/books/v1'),
  GOOGLE_BOOKS_API_KEY: z.string().min(1).optional(),
  LOOKUP_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(8000),
  LOOKUP_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(86_400),
  // Shared ISBN catalogue (`catalog_books`): refresh cadence of stored
  // metadata and how long an unknown ISBN is remembered before retrying.
  CATALOG_REFRESH_DAYS: z.coerce.number().int().min(1).default(180),
  CATALOG_MISS_DAYS: z.coerce.number().int().min(0).default(7),
  // Book covers: where the WebP files live (defaults to a `covers` directory
  // next to the SQLite file, i.e. /data/covers in Docker), how long "no
  // provider has a cover" is remembered, when unreferenced shared covers are
  // collected, and the pause between provider requests (Open Library: ≤ 1/s).
  COVERS_DIR: z.string().min(1).optional(),
  OPEN_LIBRARY_COVERS_URL: z.url().default('https://covers.openlibrary.org'),
  COVERS_MISS_DAYS: z.coerce.number().int().min(0).default(30),
  COVERS_GC_DAYS: z.coerce.number().int().min(0).default(90),
  COVERS_MIN_INTERVAL_MS: z.coerce.number().int().min(0).default(1000),
  // Built SPA directory (`apps/web/dist`). When set, the API serves it too, so
  // one process (the Docker image) is one origin. Unset in `pnpm dev`.
  WEB_DIST: z.string().min(1).optional(),
  // Accounts: Google sign-in (OIDC). Without the client id/secret the API
  // boots but `/api/auth/google` answers 503 `auth_not_configured`.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  // Public origin of the app; the redirect URI registered in Google Cloud is
  // `${AUTH_BASE_URL}/api/auth/google/callback`. Defaults to localhost:PORT.
  AUTH_BASE_URL: z.url().optional(),
  // Signs the short-lived cookie that carries the in-flight OAuth state.
  AUTH_COOKIE_SECRET: z.string().min(32).optional(),
  // Comma-separated emails allowed to create an account (unset = anyone).
  AUTH_ALLOWED_EMAILS: z.string().optional(),
  AUTH_SESSION_DAYS: z.coerce.number().int().min(1).max(400).default(30),
});

export type Env = z.infer<typeof envSchema>;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DbConfig {
  driver: Env['DB_DRIVER'];
  sqlitePath: string;
  url?: string;
}

export interface LookupConfig {
  openLibraryUrl: string;
  googleBooksUrl: string;
  googleBooksApiKey?: string;
  timeoutMs: number;
  /** In-memory TTL for free-text search results (ISBN lookups live in `catalog_books`). */
  cacheTtlMs: number;
  /** Age past which a catalogue row is refreshed in the background. */
  catalogRefreshMs: number;
  /** How long a miss is remembered before the providers are asked again. */
  catalogMissMs: number;
}

export interface CoversConfig {
  /** Absolute directory holding `<xx>/<sha256>.webp` files. */
  dir: string;
  openLibraryUrl: string;
  openLibraryCoversUrl: string;
  googleBooksUrl: string;
  googleBooksApiKey?: string;
  timeoutMs: number;
  missMs: number;
  gcSharedAfterMs: number;
  minIntervalMs: number;
}

export interface AuthConfig {
  /** Both set ⇒ Google sign-in is enabled. */
  googleClientId?: string;
  googleClientSecret?: string;
  /** Public origin, no trailing slash. */
  baseUrl: string;
  /** `${baseUrl}/api/auth/google/callback` — what Google Cloud must list. */
  redirectUri: string;
  cookieSecret: string;
  /** `true` when no `AUTH_COOKIE_SECRET` was given and a per-process one is in use. */
  cookieSecretGenerated: boolean;
  /** Normalised allow-list, or `null` for "anyone with a Google account". */
  allowedEmails: Set<string> | null;
  sessionTtlMs: number;
}

export interface AppConfig {
  env: Env['NODE_ENV'];
  port: number;
  db: DbConfig;
  lookup: LookupConfig;
  covers: CoversConfig;
  auth: AuthConfig;
  /** Absolute path of the built web app to serve, if any. */
  webDist?: string;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = envSchema.parse(source);
  const authBaseUrl = (env.AUTH_BASE_URL ?? `http://localhost:${env.PORT}`).replace(/\/$/, '');
  return {
    env: env.NODE_ENV,
    port: env.PORT,
    db: {
      driver: env.DB_DRIVER,
      sqlitePath: env.DATABASE_PATH,
      url: env.DATABASE_URL,
    },
    lookup: {
      openLibraryUrl: env.OPEN_LIBRARY_URL,
      googleBooksUrl: env.GOOGLE_BOOKS_URL,
      googleBooksApiKey: env.GOOGLE_BOOKS_API_KEY,
      timeoutMs: env.LOOKUP_TIMEOUT_MS,
      cacheTtlMs: env.LOOKUP_CACHE_TTL_SECONDS * 1000,
      catalogRefreshMs: env.CATALOG_REFRESH_DAYS * DAY_MS,
      catalogMissMs: env.CATALOG_MISS_DAYS * DAY_MS,
    },
    covers: {
      dir: resolve(env.COVERS_DIR ?? resolve(dirname(env.DATABASE_PATH), 'covers')),
      openLibraryUrl: env.OPEN_LIBRARY_URL,
      openLibraryCoversUrl: env.OPEN_LIBRARY_COVERS_URL,
      googleBooksUrl: env.GOOGLE_BOOKS_URL,
      googleBooksApiKey: env.GOOGLE_BOOKS_API_KEY,
      timeoutMs: env.LOOKUP_TIMEOUT_MS,
      missMs: env.COVERS_MISS_DAYS * DAY_MS,
      gcSharedAfterMs: env.COVERS_GC_DAYS * DAY_MS,
      minIntervalMs: env.COVERS_MIN_INTERVAL_MS,
    },
    auth: {
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET,
      baseUrl: authBaseUrl,
      redirectUri: `${authBaseUrl}/api/auth/google/callback`,
      cookieSecret: env.AUTH_COOKIE_SECRET ?? randomBytes(32).toString('base64url'),
      cookieSecretGenerated: env.AUTH_COOKIE_SECRET === undefined,
      allowedEmails: parseAllowedEmails(env.AUTH_ALLOWED_EMAILS),
      sessionTtlMs: env.AUTH_SESSION_DAYS * DAY_MS,
    },
    webDist: env.WEB_DIST === undefined ? undefined : resolve(env.WEB_DIST),
  };
}
