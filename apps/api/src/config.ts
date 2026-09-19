import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { dbDriverSchema } from '@bookguardian/shared';

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
  // Built SPA directory (`apps/web/dist`). When set, the API serves it too, so
  // one process (the Docker image) is one origin. Unset in `pnpm dev`.
  WEB_DIST: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

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
  cacheTtlMs: number;
}

export interface AppConfig {
  env: Env['NODE_ENV'];
  port: number;
  db: DbConfig;
  lookup: LookupConfig;
  /** Absolute path of the built web app to serve, if any. */
  webDist?: string;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = envSchema.parse(source);
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
    },
    webDist: env.WEB_DIST === undefined ? undefined : resolve(env.WEB_DIST),
  };
}
