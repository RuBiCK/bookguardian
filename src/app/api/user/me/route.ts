import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET() {
  try {
    const user = await requireAuth()

    const rl = rateLimit(`user-me:${user.id}`)
    if (!rl.success) return rateLimitResponse(rl.resetTime)

    const userData = await prisma.user.findUnique({
      where: { id: user.id as string },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tier: true,
      },
    })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(userData)
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
