import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-helpers'

export async function GET() {
    try {
        const user = await requireAuth()

        const books = await prisma.book.findMany({
            where: {
                shelf: {
                    library: {
                        userId: user.id
                    }
                }
            },
            include: {
                shelf: {
                    include: {
                        library: true
                    }
                },
                tags: true,
                lendings: {
                    where: {
                        status: 'LENT'
                    }
                }
            },
            orderBy: {
                title: 'asc'
            }
        })

        // Transform the data for easier export
        const exportData = books.map((book: any) => ({
            id: book.id,
            title: book.title,
            author: book.author,
            isbn: book.isbn || '',
            publisher: book.publisher || '',
            year: book.year || '',
            language: book.language || '',
            category: book.category || '',
            rating: book.rating || 0,
            readStatus: book.readStatus,
            comment: book.comment || '',
            shelf: book.shelf.name,
            library: book.shelf.library.name,
            libraryLocation: book.shelf.library.location || '',
            tags: book.tags.map((tag: any) => tag.name).join('; '),
            coverUrl: book.coverUrl || '',
            lentTo: book.lendings.length > 0 ? book.lendings[0].borrowerName : '',
            createdAt: book.createdAt.toISOString(),
            updatedAt: book.updatedAt.toISOString()
        }))

        return NextResponse.json(exportData)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error fetching books for export:', error)
        return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 })
    }
}
