import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const libraries = await prisma.library.findMany({
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
        return NextResponse.json(libraries)
    } catch (error) {
        console.error('Error fetching libraries:', error)
        return NextResponse.json({ error: 'Error fetching libraries' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { name, location } = body

        const library = await prisma.library.create({
            data: {
                name,
                location,
                shelves: {
                    create: { name: 'Default Shelf' }
                }
            },
            include: { shelves: true }
        })

        return NextResponse.json(library)
    } catch (error) {
        console.error('Error creating library:', error)
        return NextResponse.json({ error: 'Error creating library' }, { status: 500 })
    }
}
