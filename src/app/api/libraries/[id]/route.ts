import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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

        return NextResponse.json(library)
    } catch (error) {
        console.error('Error fetching library:', error)
        return NextResponse.json({ error: 'Error fetching library' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.library.delete({
            where: { id }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting library:', error)
        return NextResponse.json({ error: 'Error deleting library' }, { status: 500 })
    }
}
