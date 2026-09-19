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
});

export type Env = z.infer<typeof envSchema>;

export interface DbConfig {
  driver: Env['DB_DRIVER'];
  sqlitePath: string;
  url?: string;
}

export interface AppConfig {
  env: Env['NODE_ENV'];
  port: number;
  db: DbConfig;
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
  };
}
