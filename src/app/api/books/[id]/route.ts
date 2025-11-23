import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const book = await prisma.book.findUnique({
            where: { id },
            include: {
                lendings: true,
                tags: true,
            },
        })

        if (!book) {
            return NextResponse.json({ error: 'Book not found' }, { status: 404 })
        }

        return NextResponse.json(book)
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching book' }, { status: 500 })
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
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
            tags, // Array of strings
        } = body

        // Prepare tag updates
        let tagUpdate = undefined
        if (tags) {
            // First, we need to disconnect all existing tags if we are updating tags
            // But Prisma's set or disconnect logic in update is a bit tricky with many-to-many
            // A simple way is to set the new list.
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
                year: year ? parseInt(year) : undefined,
                publisher,
                language,
                rating: rating ? parseInt(rating) : undefined,
                comment,
                readStatus,
                shelfId,
                tags: tagUpdate,
            },
            include: {
                tags: true,
            }
        })

        return NextResponse.json(book)
    } catch (error) {
        console.error('Error updating book:', error)
        return NextResponse.json({ error: 'Error updating book' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.book.delete({
            where: { id },
        })
        return NextResponse.json({ message: 'Book deleted' })
    } catch (error) {
        console.error('Error deleting book:', error)
        return NextResponse.json({ error: 'Error deleting book' }, { status: 500 })
    }
}
