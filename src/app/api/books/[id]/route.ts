import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-helpers'
import { UpdateBookSchema } from '@/lib/validation'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth()

        const rl = rateLimit(`books-get:${user.id}`)
        if (!rl.success) return rateLimitResponse(rl.resetTime)

        const { id } = await params

        const book = await prisma.book.findUnique({
            where: { id },
            include: {
                shelf: {
                    include: {
                        library: true
                    }
                },
                lendings: true,
                tags: true,
            },
        })

        if (!book) {
            return NextResponse.json({ error: 'Book not found' }, { status: 404 })
        }

        // Verify book belongs to user
        if (book.shelf.library.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        return NextResponse.json(book)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        return NextResponse.json({ error: 'Error fetching book' }, { status: 500 })
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth()
        const { id } = await params

        const rl = rateLimit(`books-patch:${user.id}`, { limit: 20 })
        if (!rl.success) return rateLimitResponse(rl.resetTime)

        const body = await request.json()
        const validation = UpdateBookSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validation.error.issues },
                { status: 400 }
            )
        }

        const {
            title,
            author,
            isbn,
            coverUrl,
            category,
            year,
            publisher,
            language,
            rating,
            comment,
            readStatus,
            shelfId,
            tags,
        } = validation.data

        // Verify book belongs to user before updating
        const existingBook = await prisma.book.findUnique({
            where: { id },
            include: {
                shelf: {
                    include: {
                        library: true
                    }
                }
            }
        })

        if (!existingBook) {
            return NextResponse.json({ error: 'Book not found' }, { status: 404 })
        }

        if (existingBook.shelf.library.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // If shelfId is being updated, verify new shelf belongs to user
        if (shelfId && shelfId !== existingBook.shelfId) {
            const newShelf = await prisma.shelf.findFirst({
                where: {
                    id: shelfId,
                    library: {
                        userId: user.id
                    }
                }
            })
            if (!newShelf) {
                return NextResponse.json(
                    { error: 'Target shelf not found or unauthorized' },
                    { status: 403 }
                )
            }
        }

        // Prepare tag updates
        let tagUpdate = undefined
        if (tags) {
            tagUpdate = {
                set: [], // Disconnect all
                connectOrCreate: tags.map((tag: string) => ({
                    where: { name: tag },
                    create: { name: tag },
                }))
            }
        }

        const book = await prisma.book.update({
            where: { id },
            data: {
                title,
                author,
                isbn,
                coverUrl,
                category,
                year: year ?? undefined,
                publisher,
                language,
                rating: rating ?? undefined,
                comment,
                readStatus,
                shelfId,
                tags: tagUpdate,
            },
            include: {
                shelf: {
                    include: {
                        library: true
                    }
                },
                lendings: true,
                tags: true,
            }
        })

        return NextResponse.json(book)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error updating book:', error)
        return NextResponse.json({ error: 'Error updating book' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth()

        const rl = rateLimit(`books-delete:${user.id}`, { limit: 10 })
        if (!rl.success) return rateLimitResponse(rl.resetTime)

        const { id } = await params

        // Verify book belongs to user before deleting
        const book = await prisma.book.findUnique({
            where: { id },
            include: {
                shelf: {
                    include: {
                        library: true
                    }
                }
            }
        })

        if (!book) {
            return NextResponse.json({ error: 'Book not found' }, { status: 404 })
        }

        if (book.shelf.library.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        await prisma.book.delete({
            where: { id },
        })

        return NextResponse.json({ message: 'Book deleted' })
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error deleting book:', error)
        return NextResponse.json({ error: 'Error deleting book' }, { status: 500 })
    }
}
