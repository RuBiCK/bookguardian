import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { name, libraryId } = body

        const shelf = await prisma.shelf.create({
            data: {
                name,
                libraryId
            }
        })

        return NextResponse.json(shelf)
    } catch (error) {
        console.error('Error creating shelf:', error)
        return NextResponse.json({ error: 'Error creating shelf' }, { status: 500 })
    }
}
