import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-helpers'
import { QUOTA_TIERS, TierType } from '@/lib/quota-config'
import { UpdateUserSchema } from '@/lib/validation'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()

    const rl = rateLimit(`admin-patch:${admin.id}`, { limit: 20 })
    if (!rl.success) return rateLimitResponse(rl.resetTime)

    const { id } = await params
    const body = await request.json()

    const validation = UpdateUserSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { tier, role } = validation.data

    // Prevent admin from modifying their own role
    if (role && admin.id === id) {
      return NextResponse.json(
        { error: 'Cannot modify your own role' },
        { status: 403 }
      )
    }

    const updateData: any = {}

    // Update tier and quotas
    if (tier && tier in QUOTA_TIERS) {
      const tierConfig = QUOTA_TIERS[tier as TierType]
      updateData.tier = tier
      updateData.monthlyTokenQuota = tierConfig.monthlyTokens
      updateData.monthlyCallQuota = tierConfig.monthlyCalls
    }

    // Update role
    if (role && ['USER', 'ADMIN'].includes(role)) {
      updateData.role = role
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tier: true,
        monthlyTokenQuota: true,
        monthlyCallQuota: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error updating user:', error)

    if (error instanceof Error && error.message.includes('Admin')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}
