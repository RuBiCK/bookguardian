import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-helpers'

export async function GET() {
    try {
        const user = await requireAuth()

        const userBooksWhere = {
            shelf: {
                library: {
                    userId: user.id
                }
            }
        }

        const [totalBooks, readStatusCounts, categoryCounts] = await Promise.all([
            // Total Books for user
            prisma.book.count({
                where: userBooksWhere
            }),

            // Books by Read Status for user
            prisma.book.groupBy({
                by: ['readStatus'],
                where: userBooksWhere,
                _count: {
                    readStatus: true
                }
            }),

            // Books by Category (Top 5) for user
            prisma.book.groupBy({
                by: ['category'],
                where: userBooksWhere,
                _count: {
                    category: true
                },
                orderBy: {
                    _count: {
                        category: 'desc'
                    }
                },
                take: 5
            })
        ])

        return NextResponse.json({
            totalBooks,
            readStatusCounts: readStatusCounts.map(item => ({
                status: item.readStatus,
                count: item._count.readStatus
            })),
            categoryCounts: categoryCounts.map(item => ({
                category: item.category || 'Uncategorized',
                count: item._count.category
            }))
        })
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error fetching stats:', error)
        return NextResponse.json({ error: 'Error fetching stats' }, { status: 500 })
    }
}
