import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-helpers'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { isSourceTag } from '@/lib/source-tags'

export async function GET() {
    try {
        const user = await requireAuth()

        const rl = rateLimit(`tags-get:${user.id}`)
        if (!rl.success) return rateLimitResponse(rl.resetTime)

        // Get tags that are used in the user's books (private tags) with book count
        const tags = await prisma.tag.findMany({
            where: {
                books: {
                    some: {
                        shelf: {
                            library: {
                                userId: user.id
                            }
                        }
                    }
                }
            },
            include: {
                _count: {
                    select: { books: true }
                }
            },
            orderBy: {
                books: {
                    _count: 'desc'
                }
            },
        })

        // Filter out source tags and map to include count
        const result = tags
            .filter(tag => !isSourceTag(tag.name))
            .map(tag => ({
                id: tag.id,
                name: tag.name,
                count: tag._count.books,
            }))

        return NextResponse.json(result)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error fetching tags:', error)
        return NextResponse.json({ error: 'Error fetching tags' }, { status: 500 })
    }
}
