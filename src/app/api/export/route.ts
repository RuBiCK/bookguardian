import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
    try {
        const books = await prisma.book.findMany({
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
        console.error('Error fetching books for export:', error)
        return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 })
    }
}
