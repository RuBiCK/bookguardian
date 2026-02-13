/**
 * In-memory rate limiter
 * For multi-instance production, swap for Redis-backed implementation.
 */
import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

const store = new Map<string, RateLimitEntry>()
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60_000

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) store.delete(key)
  }
}

export function rateLimit(
  identifier: string,
  options: { limit?: number; windowMs?: number } = {}
): { success: boolean; remaining: number; resetTime?: number } {
  const { limit = 30, windowMs = 60_000 } = options
  cleanup()

  const now = Date.now()
  const entry = store.get(identifier)

  if (!entry || now > entry.resetTime) {
    const resetTime = now + windowMs
    store.set(identifier, { count: 1, resetTime })
    return { success: true, remaining: limit - 1, resetTime }
  }

  entry.count++

  if (entry.count > limit) {
    return { success: false, remaining: 0, resetTime: entry.resetTime }
  }

  return { success: true, remaining: limit - entry.count, resetTime: entry.resetTime }
}

export function rateLimitResponse(resetTime?: number): NextResponse {
  const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 60
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.', retryAfter },
    {
      status: 429,
      headers: { 'Retry-After': retryAfter.toString() },
    }
  )
}
