import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimit } from './rate-limit'

// Mock next/server since we only test the rateLimit function, not rateLimitResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn(),
  },
}))

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Set a fixed "now" so tests are deterministic
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('first request succeeds with remaining = limit - 1', () => {
    const result = rateLimit('test-first-request', { limit: 5, windowMs: 60_000 })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('returns resetTime on first request', () => {
    const now = Date.now()
    const result = rateLimit('test-reset-time', { limit: 5, windowMs: 60_000 })
    expect(result.resetTime).toBe(now + 60_000)
  })

  it('requests up to the limit all succeed', () => {
    const limit = 3
    const id = 'test-up-to-limit'

    for (let i = 0; i < limit; i++) {
      const result = rateLimit(id, { limit, windowMs: 60_000 })
      expect(result.success).toBe(true)
    }
  })

  it('remaining decreases with each request', () => {
    const limit = 5
    const id = 'test-remaining-decrease'

    for (let i = 0; i < limit; i++) {
      const result = rateLimit(id, { limit, windowMs: 60_000 })
      expect(result.remaining).toBe(limit - 1 - i)
    }
  })

  it('request at limit + 1 fails with success: false', () => {
    const limit = 3
    const id = 'test-over-limit'

    for (let i = 0; i < limit; i++) {
      rateLimit(id, { limit, windowMs: 60_000 })
    }

    const result = rateLimit(id, { limit, windowMs: 60_000 })
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('different identifiers have separate counters', () => {
    const limit = 2

    // Exhaust limit for id-a
    rateLimit('id-a', { limit, windowMs: 60_000 })
    rateLimit('id-a', { limit, windowMs: 60_000 })
    const exhausted = rateLimit('id-a', { limit, windowMs: 60_000 })
    expect(exhausted.success).toBe(false)

    // id-b should still have full capacity
    const result = rateLimit('id-b', { limit, windowMs: 60_000 })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('window expiry resets the counter', () => {
    const limit = 2
    const windowMs = 10_000
    const id = 'test-window-expiry'

    // Exhaust the limit
    rateLimit(id, { limit, windowMs })
    rateLimit(id, { limit, windowMs })
    const exhausted = rateLimit(id, { limit, windowMs })
    expect(exhausted.success).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1)

    // Should be allowed again
    const result = rateLimit(id, { limit, windowMs })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(limit - 1)
  })

  it('uses default limit of 30 and windowMs of 60000', () => {
    const id = 'test-defaults'
    const result = rateLimit(id)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(29)
    expect(result.resetTime).toBe(Date.now() + 60_000)
  })

  it('cleanup removes expired entries', () => {
    const windowMs = 5_000
    const id = 'test-cleanup'

    // Create an entry
    rateLimit(id, { limit: 10, windowMs })

    // Advance past the window AND past the cleanup interval (60s)
    vi.advanceTimersByTime(61_000)

    // Trigger a call which invokes cleanup internally
    // After cleanup, old entries should be gone.
    // The new call should succeed as a fresh entry.
    const result = rateLimit('test-cleanup-trigger', { limit: 10, windowMs: 60_000 })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(9)

    // The old id should also be fresh now (cleaned up and expired)
    const resultOld = rateLimit(id, { limit: 10, windowMs })
    expect(resultOld.success).toBe(true)
    expect(resultOld.remaining).toBe(9)
  })
})
