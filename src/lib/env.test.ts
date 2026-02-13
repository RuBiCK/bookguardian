import { describe, it, expect, beforeEach, vi } from 'vitest'

// We need to dynamically import env.ts because it evaluates at import time.
// Each test sets up process.env, resets modules, then imports fresh.

const REQUIRED_VARS = {
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  DATABASE_URL: 'postgresql://localhost:5432/testdb',
  NEXTAUTH_SECRET: 'test-nextauth-secret',
}

describe('env validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    // Start with a clean env for each test - preserve only NODE_ENV
    process.env = { ...originalEnv }
    // Clear all the vars we care about
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.DATABASE_URL
    delete process.env.NEXTAUTH_SECRET
    delete process.env.NEXTAUTH_URL
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_MODEL
    delete process.env.OPENAI_ORG
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_MODEL
    delete process.env.GOOGLE_AI_API_KEY
    delete process.env.GOOGLE_MODEL
    delete process.env.AI_PROVIDER
    delete process.env.GOOGLE_BOOKS_API_KEY
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws when GOOGLE_CLIENT_ID is missing', async () => {
    process.env.GOOGLE_CLIENT_SECRET = REQUIRED_VARS.GOOGLE_CLIENT_SECRET
    process.env.DATABASE_URL = REQUIRED_VARS.DATABASE_URL
    process.env.NEXTAUTH_SECRET = REQUIRED_VARS.NEXTAUTH_SECRET

    await expect(() => import('./env')).rejects.toThrow(
      'Missing required environment variable: GOOGLE_CLIENT_ID'
    )
  })

  it('throws when GOOGLE_CLIENT_SECRET is missing', async () => {
    process.env.GOOGLE_CLIENT_ID = REQUIRED_VARS.GOOGLE_CLIENT_ID
    process.env.DATABASE_URL = REQUIRED_VARS.DATABASE_URL
    process.env.NEXTAUTH_SECRET = REQUIRED_VARS.NEXTAUTH_SECRET

    await expect(() => import('./env')).rejects.toThrow(
      'Missing required environment variable: GOOGLE_CLIENT_SECRET'
    )
  })

  it('throws when DATABASE_URL is missing', async () => {
    process.env.GOOGLE_CLIENT_ID = REQUIRED_VARS.GOOGLE_CLIENT_ID
    process.env.GOOGLE_CLIENT_SECRET = REQUIRED_VARS.GOOGLE_CLIENT_SECRET
    process.env.NEXTAUTH_SECRET = REQUIRED_VARS.NEXTAUTH_SECRET

    await expect(() => import('./env')).rejects.toThrow(
      'Missing required environment variable: DATABASE_URL'
    )
  })

  it('throws when NEXTAUTH_SECRET is missing', async () => {
    process.env.GOOGLE_CLIENT_ID = REQUIRED_VARS.GOOGLE_CLIENT_ID
    process.env.GOOGLE_CLIENT_SECRET = REQUIRED_VARS.GOOGLE_CLIENT_SECRET
    process.env.DATABASE_URL = REQUIRED_VARS.DATABASE_URL

    await expect(() => import('./env')).rejects.toThrow(
      'Missing required environment variable: NEXTAUTH_SECRET'
    )
  })

  it('returns values for all required vars when present', async () => {
    Object.assign(process.env, REQUIRED_VARS)

    const { env } = await import('./env')
    expect(env.GOOGLE_CLIENT_ID).toBe(REQUIRED_VARS.GOOGLE_CLIENT_ID)
    expect(env.GOOGLE_CLIENT_SECRET).toBe(REQUIRED_VARS.GOOGLE_CLIENT_SECRET)
    expect(env.DATABASE_URL).toBe(REQUIRED_VARS.DATABASE_URL)
    expect(env.NEXTAUTH_SECRET).toBe(REQUIRED_VARS.NEXTAUTH_SECRET)
  })

  it('returns defaults for optional vars when not set', async () => {
    Object.assign(process.env, REQUIRED_VARS)

    const { env } = await import('./env')
    expect(env.NEXTAUTH_URL).toBe('')
    expect(env.OPENAI_API_KEY).toBe('')
    expect(env.OPENAI_MODEL).toBe('gpt-4o')
    expect(env.OPENAI_ORG).toBe('')
    expect(env.ANTHROPIC_API_KEY).toBe('')
    expect(env.ANTHROPIC_MODEL).toBe('claude-3-5-sonnet-20241022')
    expect(env.GOOGLE_AI_API_KEY).toBe('')
    expect(env.GOOGLE_MODEL).toBe('gemini-1.5-pro')
    expect(env.AI_PROVIDER).toBe('openai')
    expect(env.GOOGLE_BOOKS_API_KEY).toBe('')
    expect(env.NODE_ENV).toBe('development')
  })

  it('returns actual values for optional vars when set', async () => {
    Object.assign(process.env, REQUIRED_VARS)
    process.env.OPENAI_API_KEY = 'sk-test-key'
    process.env.OPENAI_MODEL = 'gpt-4-turbo'
    process.env.AI_PROVIDER = 'anthropic'
    process.env.NODE_ENV = 'production'
    process.env.NEXTAUTH_URL = 'https://example.com'
    process.env.ANTHROPIC_API_KEY = 'ant-test-key'
    process.env.ANTHROPIC_MODEL = 'claude-3-opus'
    process.env.GOOGLE_AI_API_KEY = 'gai-test-key'
    process.env.GOOGLE_MODEL = 'gemini-2.0'
    process.env.GOOGLE_BOOKS_API_KEY = 'gb-test-key'

    const { env } = await import('./env')
    expect(env.OPENAI_API_KEY).toBe('sk-test-key')
    expect(env.OPENAI_MODEL).toBe('gpt-4-turbo')
    expect(env.AI_PROVIDER).toBe('anthropic')
    expect(env.NODE_ENV).toBe('production')
    expect(env.NEXTAUTH_URL).toBe('https://example.com')
    expect(env.ANTHROPIC_API_KEY).toBe('ant-test-key')
    expect(env.ANTHROPIC_MODEL).toBe('claude-3-opus')
    expect(env.GOOGLE_AI_API_KEY).toBe('gai-test-key')
    expect(env.GOOGLE_MODEL).toBe('gemini-2.0')
    expect(env.GOOGLE_BOOKS_API_KEY).toBe('gb-test-key')
  })
})
