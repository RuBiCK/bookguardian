import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-helpers'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth()
        const { id } = await params

        const library = await prisma.library.findUnique({
            where: { id },
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

        if (!library) {
            return NextResponse.json({ error: 'Library not found' }, { status: 404 })
        }

        // Verify library belongs to user
        if (library.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        return NextResponse.json(library)
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error fetching library:', error)
        return NextResponse.json({ error: 'Error fetching library' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth()
        const { id } = await params

        // Verify library belongs to user before deleting
        const library = await prisma.library.findUnique({
            where: { id }
        })

        if (!library) {
            return NextResponse.json({ error: 'Library not found' }, { status: 404 })
        }

        if (library.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        await prisma.library.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorizedResponse()
        }
        console.error('Error deleting library:', error)
        return NextResponse.json({ error: 'Error deleting library' }, { status: 500 })
    }
}
