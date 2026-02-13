import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-helpers'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET() {
    try {
        const user = await requireAuth()

        const rl = rateLimit(`stats-get:${user.id}`)
        if (!rl.success) return rateLimitResponse(rl.resetTime)

        const userBooksWhere = {
            shelf: {
                library: {
                    userId: user.id
                }
            }
        }

        const [totalBooks, readStatusCounts, categoryCounts, lentBooks, availableBooks] = await Promise.all([
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
            }),

            // Books currently lent out
            prisma.book.count({
                where: {
                    ...userBooksWhere,
                    lendings: {
                        some: {
                            status: 'LENT'
                        }
                    }
                }
            }),

            // Books available (not lent)
            prisma.book.count({
                where: {
                    ...userBooksWhere,
                    lendings: {
                        none: {
                            status: 'LENT'
                        }
                    }
                }
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
            })),
            lendingCounts: [
                { status: 'AVAILABLE', count: availableBooks },
                { status: 'LENT', count: lentBooks }
            ]
        })
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error fetching stats:', error)
        return NextResponse.json({ error: 'Error fetching stats' }, { status: 500 })
    }
}
