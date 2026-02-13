import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getUserQuotaStatus } from '@/lib/quota-helpers'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET() {
  try {
    const user = await requireAuth()

    const rl = rateLimit(`user-usage:${user.id}`)
    if (!rl.success) return rateLimitResponse(rl.resetTime)

    const quotaStatus = await getUserQuotaStatus(user.id as string)

    return NextResponse.json(quotaStatus)
  } catch (error) {
    console.error('Error fetching user usage:', error)
    return NextResponse.json(
      { error: 'Unauthorized or failed to fetch usage' },
      { status: 401 }
    )
  }
}
