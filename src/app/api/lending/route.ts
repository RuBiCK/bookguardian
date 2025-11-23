import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
    try {
        const { bookId, borrowerName } = await request.json()

        if (!bookId || !borrowerName) {
            return NextResponse.json({ error: 'Book ID and Borrower Name are required' }, { status: 400 })
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
        console.error('Error creating lending:', error)
        return NextResponse.json({ error: 'Error creating lending' }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    try {
        const { lendingId, status } = await request.json()

        const lending = await prisma.lending.update({
            where: { id: lendingId },
            data: {
                status,
                returnDate: status === 'RETURNED' ? new Date() : null,
            },
        })

        return NextResponse.json(lending)
    } catch (error) {
        return NextResponse.json({ error: 'Error updating lending' }, { status: 500 })
    }
}
