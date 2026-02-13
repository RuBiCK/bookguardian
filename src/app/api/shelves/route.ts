import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-helpers'
import { CreateShelfSchema } from '@/lib/validation'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: Request) {
    try {
        const user = await requireAuth()

        const rl = rateLimit(`shelves-post:${user.id}`, { limit: 10 })
        if (!rl.success) return rateLimitResponse(rl.resetTime)

        const body = await request.json()
        const validation = CreateShelfSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validation.error.issues },
                { status: 400 }
            )
        }

        const { name, libraryId } = validation.data

        // Verify library belongs to user before creating shelf
        const library = await prisma.library.findUnique({
            where: { id: libraryId }
        })

        if (!library) {
            return NextResponse.json({ error: 'Library not found' }, { status: 404 })
        }

        if (library.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const shelf = await prisma.shelf.create({
            data: {
                name,
                libraryId
            }
        })

        return NextResponse.json(shelf)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error creating shelf:', error)
        return NextResponse.json({ error: 'Error creating shelf' }, { status: 500 })
    }
}
