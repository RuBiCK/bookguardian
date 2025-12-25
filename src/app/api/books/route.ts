import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-helpers'

export async function GET(request: Request) {
    try {
        const user = await requireAuth()

        const { searchParams } = new URL(request.url)
        const libraryId = searchParams.get('libraryId')
        const readStatus = searchParams.get('readStatus')
        const isLent = searchParams.get('isLent')
        const category = searchParams.get('category')
        const minRating = searchParams.get('minRating')
        const search = searchParams.get('search')
        const tags = searchParams.get('tags') // Comma separated tags

        const where: any = {
            // CRITICAL: Filter books by user through shelf → library → userId relationship
            shelf: {
                library: {
                    userId: user.id
                }
            }
        }

        if (libraryId) {
            where.shelf.libraryId = libraryId
        }

        if (readStatus) {
            where.readStatus = readStatus
        }

        if (isLent === 'true') {
            where.lendings = { some: { status: 'LENT' } }
        } else if (isLent === 'false') {
            where.NOT = { lendings: { some: { status: 'LENT' } } }
        }

        if (category) {
            where.category = category
        }

        if (minRating) {
            where.rating = { gte: parseInt(minRating) }
        }

        if (search) {
            const searchConditions: any[] = [
                { title: { contains: search, mode: 'insensitive' } },
                { author: { contains: search, mode: 'insensitive' } },
                { isbn: { contains: search } },
                { publisher: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
                { language: { contains: search, mode: 'insensitive' } },
                { comment: { contains: search, mode: 'insensitive' } },
                // Search by tag names
                {
                    tags: {
                        some: {
                            name: { contains: search, mode: 'insensitive' }
                        }
                    }
                }
            ]

            // If search term is a number, also search by year
            const yearNumber = parseInt(search)
            if (!isNaN(yearNumber)) {
                searchConditions.push({ year: yearNumber })
            }

            where.OR = searchConditions
        }

        if (tags) {
            const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
            if (tagList.length > 0) {
                where.tags = {
                    some: {
                        name: { in: tagList }
                    }
                }
            }
        }

        const books = await prisma.book.findMany({
            where,
            include: {
                shelf: {
                    include: {
                        library: true,
                    },
                },
                lendings: {
                    where: { status: 'LENT' }
                },
                tags: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        })
        return NextResponse.json(books)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error fetching books:', error)
        return NextResponse.json({ error: 'Error fetching books' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const user = await requireAuth()

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

        // If no shelfId is provided, try to find the user's default shelf
        let targetShelfId = shelfId
        if (!targetShelfId) {
            const defaultShelf = await prisma.shelf.findFirst({
                where: {
                    name: 'Default Shelf',
                    library: {
                        userId: user.id
                    }
                },
            })
            if (defaultShelf) {
                targetShelfId = defaultShelf.id
            } else {
                // Create a default library and shelf for new user
                const newLib = await prisma.library.create({
                    data: {
                        name: 'Default Library',
                        userId: user.id,
                        shelves: { create: { name: 'Default Shelf' } }
                    },
                    include: { shelves: true }
                })
                targetShelfId = newLib.shelves[0].id
            }
        } else {
            // Verify shelf belongs to user's library
            const shelf = await prisma.shelf.findFirst({
                where: {
                    id: targetShelfId,
                    library: {
                        userId: user.id
                    }
                }
            })
            if (!shelf) {
                return NextResponse.json(
                    { error: 'Shelf not found or unauthorized' },
                    { status: 403 }
                )
            }
        }

        const book = await prisma.book.create({
            data: {
                title,
                author,
                isbn,
                coverUrl,
                category,
                year: year ? parseInt(year) : undefined,
                publisher,
                language,
                rating: rating ? parseInt(rating) : 0,
                comment,
                readStatus: readStatus || 'WANT_TO_READ',
                shelfId: targetShelfId,
                tags: tags && tags.length > 0 ? {
                    connectOrCreate: tags.map((tag: string) => ({
                        where: { name: tag },
                        create: { name: tag },
                    }))
                } : undefined,
            },
            include: {
                tags: true,
            }
        })

        return NextResponse.json(book)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error creating book:', error)
        return NextResponse.json({ error: 'Error creating book' }, { status: 500 })
    }
}
