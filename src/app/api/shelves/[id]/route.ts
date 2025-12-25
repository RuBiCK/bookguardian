import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-helpers'

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth()
        const { id } = await params
        const body = await request.json()
        const { name } = body

        // Verify shelf belongs to user
        const shelf = await prisma.shelf.findUnique({
            where: { id },
            include: {
                library: true
            }
        })

        if (!shelf) {
            return NextResponse.json({ error: 'Shelf not found' }, { status: 404 })
        }

        if (shelf.library.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const updatedShelf = await prisma.shelf.update({
            where: { id },
            data: { name }
        })

        return NextResponse.json(updatedShelf)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error updating shelf:', error)
        return NextResponse.json({ error: 'Error updating shelf' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth()
        const { id } = await params

        // Verify shelf belongs to user
        const shelf = await prisma.shelf.findUnique({
            where: { id },
            include: {
                library: true,
                _count: {
                    select: { books: true }
                }
            }
        })

        if (!shelf) {
            return NextResponse.json({ error: 'Shelf not found' }, { status: 404 })
        }

        if (shelf.library.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Prevent deleting shelf if it has books
        if (shelf._count.books > 0) {
            return NextResponse.json(
                { error: 'Cannot delete shelf with books. Please move or delete the books first.' },
                { status: 400 }
            )
        }

        await prisma.shelf.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error deleting shelf:', error)
        return NextResponse.json({ error: 'Error deleting shelf' }, { status: 500 })
    }
}
