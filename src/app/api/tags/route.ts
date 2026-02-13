import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-helpers'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET() {
    try {
        const user = await requireAuth()

        const rl = rateLimit(`tags-get:${user.id}`)
        if (!rl.success) return rateLimitResponse(rl.resetTime)

        // Get tags that are used in the user's books (private tags)
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
            orderBy: {
                name: 'asc',
            },
        })
        return NextResponse.json(tags)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error fetching tags:', error)
        return NextResponse.json({ error: 'Error fetching tags' }, { status: 500 })
    }
}
