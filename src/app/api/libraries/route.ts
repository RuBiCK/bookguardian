import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-helpers'
import { CreateLibrarySchema } from '@/lib/validation'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET() {
    try {
        const user = await requireAuth()

        const rl = rateLimit(`libraries-get:${user.id}`)
        if (!rl.success) return rateLimitResponse(rl.resetTime)

        const libraries = await prisma.library.findMany({
            where: {
                userId: user.id
            },
            include: {
                shelves: {
                    include: {
                        _count: {
                            select: { books: true }
                        }
                    }
                }
            }
        })
        return NextResponse.json(libraries)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error fetching libraries:', error)
        return NextResponse.json({ error: 'Error fetching libraries' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const user = await requireAuth()

        const rl = rateLimit(`libraries-post:${user.id}`, { limit: 10 })
        if (!rl.success) return rateLimitResponse(rl.resetTime)

        const body = await request.json()
        const validation = CreateLibrarySchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validation.error.issues },
                { status: 400 }
            )
        }

        const { name, location } = validation.data

        const library = await prisma.library.create({
            data: {
                name,
                location,
                userId: user.id,
                shelves: {
                    create: { name: 'Default Shelf' }
                }
            },
            include: { shelves: true }
        })

        return NextResponse.json(library)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error creating library:', error)
        return NextResponse.json({ error: 'Error creating library' }, { status: 500 })
    }
}
