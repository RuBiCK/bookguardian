/**
 * Environment variable validation
 * Validates required environment variables at import time
 */

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalEnv(name: string, defaultValue = ''): string {
  return process.env[name] || defaultValue
}

export const env = {
  // Auth (required)
  GOOGLE_CLIENT_ID: requiredEnv('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: requiredEnv('GOOGLE_CLIENT_SECRET'),

  // Database (required - validated by Prisma but good to check early)
  DATABASE_URL: requiredEnv('DATABASE_URL'),

  // NextAuth
  NEXTAUTH_SECRET: requiredEnv('NEXTAUTH_SECRET'),
  NEXTAUTH_URL: optionalEnv('NEXTAUTH_URL'),

  // AI Providers (at least one required at runtime)
  OPENAI_API_KEY: optionalEnv('OPENAI_API_KEY'),
  OPENAI_MODEL: optionalEnv('OPENAI_MODEL', 'gpt-4o'),
  OPENAI_ORG: optionalEnv('OPENAI_ORG'),

  ANTHROPIC_API_KEY: optionalEnv('ANTHROPIC_API_KEY'),
  ANTHROPIC_MODEL: optionalEnv('ANTHROPIC_MODEL', 'claude-3-5-sonnet-20241022'),

  GOOGLE_AI_API_KEY: optionalEnv('GOOGLE_AI_API_KEY'),
  GOOGLE_MODEL: optionalEnv('GOOGLE_MODEL', 'gemini-1.5-pro'),

  AI_PROVIDER: optionalEnv('AI_PROVIDER', 'openai'),

  // External APIs
  GOOGLE_BOOKS_API_KEY: optionalEnv('GOOGLE_BOOKS_API_KEY'),

  // Runtime
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
} as const
