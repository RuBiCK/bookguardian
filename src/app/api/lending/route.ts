import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-helpers'

export async function POST(request: Request) {
    try {
        const user = await requireAuth()

        const { bookId, borrowerName } = await request.json()

        if (!bookId || !borrowerName) {
            return NextResponse.json({ error: 'Book ID and Borrower Name are required' }, { status: 400 })
        }

        // Verify book belongs to user
        const book = await prisma.book.findUnique({
            where: { id: bookId },
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

        // Check if book is already lent
        const existingLending = await prisma.lending.findFirst({
            where: {
                bookId,
                status: 'LENT'
            }
        })

        if (existingLending) {
            return NextResponse.json({ error: 'Book is already lent out' }, { status: 400 })
        }

        const lending = await prisma.lending.create({
            data: {
                bookId,
                borrowerName,
                status: 'LENT',
            },
        })

        return NextResponse.json(lending)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error creating lending:', error)
        return NextResponse.json({ error: 'Error creating lending' }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    try {
        const user = await requireAuth()

        const { lendingId, status } = await request.json()

        // Verify lending belongs to user's book
        const existingLending = await prisma.lending.findUnique({
            where: { id: lendingId },
            include: {
                book: {
                    include: {
                        shelf: {
                            include: {
                                library: true
                            }
                        }
                    }
                }
            }
        })

        if (!existingLending) {
            return NextResponse.json({ error: 'Lending record not found' }, { status: 404 })
        }

        if (existingLending.book.shelf.library.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const lending = await prisma.lending.update({
            where: { id: lendingId },
            data: {
                status,
                returnDate: status === 'RETURNED' ? new Date() : null,
            },
        })

        return NextResponse.json(lending)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        return NextResponse.json({ error: 'Error updating lending' }, { status: 500 })
    }
}
