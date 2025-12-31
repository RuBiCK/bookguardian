import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-helpers'

export async function GET() {
  try {
    await requireAdmin()

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        tier: true,
        monthlyTokenQuota: true,
        monthlyCallQuota: true,
        tokensUsed: true,
        callsUsed: true,
        quotaResetDate: true,
        createdAt: true,
        lastLogin: true,
        libraries: {
          select: {
            shelves: {
              select: {
                _count: {
                  select: {
                    books: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            libraries: true,
            usageLogs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate total books for each user
    const usersWithBookCount = users.map((user) => {
      const totalBooks = user.libraries.reduce(
        (total, library) =>
          total +
          library.shelves.reduce(
            (shelfTotal, shelf) => shelfTotal + shelf._count.books,
            0
          ),
        0
      )

      const { libraries, ...userWithoutLibraries } = user
      return {
        ...userWithoutLibraries,
        totalBooks,
      }
    })

    return NextResponse.json({ users: usersWithBookCount })
  } catch (error) {
    console.error('Error fetching users:', error)

    if (error instanceof Error && error.message.includes('Admin')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
