import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

interface GoogleBooksVolume {
  volumeInfo: {
    title?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    categories?: string[]
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
    industryIdentifiers?: Array<{
      type: string
      identifier: string
    }>
  }
}

/**
 * Search books using Google Books API
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'anonymous'
    const rl = rateLimit(`book-search:${ip}`, { limit: 20 })
    if (!rl.success) return rateLimitResponse(rl.resetTime)

    const { query } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GOOGLE_BOOKS_API_KEY
    const searchQuery = encodeURIComponent(query.trim())

    // Build URL with or without API key
    const baseUrl = 'https://www.googleapis.com/books/v1/volumes'
    const url = apiKey
      ? `${baseUrl}?q=${searchQuery}&maxResults=10&key=${apiKey}`
      : `${baseUrl}?q=${searchQuery}&maxResults=10`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({
        results: [],
        message: 'No books found'
      })
    }

    // Transform results
    const results = data.items.map((item: GoogleBooksVolume) => {
      const info = item.volumeInfo

      // Extract ISBN (prefer ISBN_13, fallback to ISBN_10)
      let isbn: string | undefined
      if (info.industryIdentifiers) {
        const isbn13 = info.industryIdentifiers.find(id => id.type === 'ISBN_13')
        const isbn10 = info.industryIdentifiers.find(id => id.type === 'ISBN_10')
        isbn = isbn13?.identifier || isbn10?.identifier
      }

      // Extract year from publishedDate
      let year: number | undefined
      if (info.publishedDate) {
        const yearMatch = info.publishedDate.match(/^\d{4}/)
        if (yearMatch) {
          year = parseInt(yearMatch[0])
        }
      }

      return {
        title: info.title || 'Unknown Title',
        author: info.authors?.join(', '),
        isbn,
        coverUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://'),
        publisher: info.publisher,
        year,
        category: info.categories?.[0],
      }
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('[BookSearch] Error:', error)
    return NextResponse.json(
      { error: 'Failed to search books' },
      { status: 500 }
    )
  }
}
