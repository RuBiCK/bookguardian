import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const [totalBooks, readStatusCounts, categoryCounts] = await Promise.all([
            // Total Books
            prisma.book.count(),

            // Books by Read Status
            prisma.book.groupBy({
                by: ['readStatus'],
                _count: {
                    readStatus: true
                }
            }),

            // Books by Category (Top 5)
            prisma.book.groupBy({
                by: ['category'],
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
        console.error('Error fetching stats:', error)
        return NextResponse.json({ error: 'Error fetching stats' }, { status: 500 })
    }
}
