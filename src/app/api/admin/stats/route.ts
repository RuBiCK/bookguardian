import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-helpers'

export async function GET() {
  try {
    await requireAdmin()

    const [
      totalUsers,
      tierCounts,
      totalTokensUsed,
      totalCallsUsed,
      usageToday,
      recentLogs,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Users by tier
      prisma.user.groupBy({
        by: ['tier'],
        _count: true,
      }),

      // Total tokens consumed
      prisma.user.aggregate({
        _sum: { tokensUsed: true },
      }),

      // Total API calls
      prisma.user.aggregate({
        _sum: { callsUsed: true },
      }),

      // Usage in last 24 hours
      prisma.usageLog.aggregate({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        _sum: { totalTokens: true },
        _count: true,
      }),

      // Recent usage logs (last 10)
      prisma.usageLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      }),
    ])

    return NextResponse.json({
      totalUsers,
      tierDistribution: tierCounts,
      usage: {
        totalTokens: totalTokensUsed._sum.tokensUsed || 0,
        totalCalls: totalCallsUsed._sum.callsUsed || 0,
        last24Hours: {
          tokens: usageToday._sum.totalTokens || 0,
          calls: usageToday._count,
        },
      },
      recentLogs,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)

    if (error instanceof Error && error.message.includes('Admin')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
