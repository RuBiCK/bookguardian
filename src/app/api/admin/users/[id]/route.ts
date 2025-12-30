import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-helpers'
import { QUOTA_TIERS, TierType } from '@/lib/quota-config'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { tier, role } = body

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
      where: { id: params.id },
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
