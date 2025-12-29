'use server'

import { getAIProvider } from '@/lib/ai/factory'
import { searchGoogleBooks } from './google-books'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import {
  EnrichedDetectedBook,
  ShelfAnalysisWithCollection,
  AIProviderError,
} from '@/lib/ai/types'
import { createSourceTag } from '@/lib/source-tags'

/**
 * Analiza una imagen de estantería y detecta todos los libros
 * Retorna los libros detectados con información sobre si ya están en la colección
 */
export async function analyzeShelfImage(base64Image: string) {
  try {
    // 1. Verificar autenticación
    const user = await requireAuth()

    // 2. Obtener provider de IA
    const aiProvider = getAIProvider()
    console.log(`[ShelfAnalysis] Using AI provider: ${aiProvider.name}`)

    // 3. Analizar imagen con IA
    console.log('[ShelfAnalysis] Starting shelf analysis...')
    const shelfAnalysis = await aiProvider.analyzeShelf(base64Image, {
      compressionQuality: 0.85,
      detectionThreshold: 0.7,
    })

    console.log(`[ShelfAnalysis] Detected ${shelfAnalysis.totalDetected} books`)

    // 4. Verificar cuáles libros ya están en la colección del usuario
    const enrichedBooks = await enrichBooksWithCollectionStatus(
      shelfAnalysis.books,
      user.id as string
    )

    // 5. Enriquecer con Google Books API (opcional, solo para libros no en colección)
    const enrichedWithGoogle = await enrichWithGoogleBooks(enrichedBooks)

    // 6. Calcular estadísticas
    const stats = {
      totalDetected: enrichedBooks.length,
      inCollection: enrichedBooks.filter(b => b.inCollection).length,
      notInCollection: enrichedBooks.filter(b => !b.inCollection).length,
    }

    console.log('[ShelfAnalysis] Stats:', stats)

    return {
      success: true,
      data: {
        analysis: shelfAnalysis,
        enrichedBooks: enrichedWithGoogle,
        stats,
      } as ShelfAnalysisWithCollection,
    }
  } catch (error) {
    console.error('[ShelfAnalysis] Error:', error)

    if (error instanceof AIProviderError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        retryable: error.retryable,
      }
    }

    return {
      success: false,
      error: 'Failed to analyze shelf image. Please try again.',
    }
  }
}

/**
 * Verifica cuáles libros detectados ya están en la colección del usuario
 * Usa fuzzy matching para título y autor
 */
async function enrichBooksWithCollectionStatus(
  detectedBooks: any[],
  userId: string
): Promise<EnrichedDetectedBook[]> {
  // Obtener todos los libros del usuario (optimización: cachear en producción)
  const userBooks = await prisma.book.findMany({
    where: {
      shelf: {
        library: {
          userId,
        },
      },
    },
    select: {
      id: true,
      title: true,
      author: true,
      isbn: true,
    },
  })

  return detectedBooks.map(detected => {
    // Buscar coincidencias por título (normalizado)
    const normalizedTitle = normalizeString(detected.title)
    const normalizedAuthor = detected.author ? normalizeString(detected.author) : null

    const match = userBooks.find(userBook => {
      const userTitle = normalizeString(userBook.title)
      const userAuthor = userBook.author ? normalizeString(userBook.author) : null

      // Matching por ISBN (más confiable)
      if (detected.isbn && userBook.isbn === detected.isbn) {
        return true
      }

      // Matching por título (similarity > 0.8)
      const titleSimilarity = stringSimilarity(normalizedTitle, userTitle)
      if (titleSimilarity > 0.8) {
        // Si hay autor, verificar también
        if (normalizedAuthor && userAuthor) {
          const authorSimilarity = stringSimilarity(normalizedAuthor, userAuthor)
          return authorSimilarity > 0.7
        }
        return true
      }

      return false
    })

    return {
      ...detected,
      inCollection: !!match,
      existingBookId: match?.id,
      matchConfidence: match ? 0.9 : undefined,
    } as EnrichedDetectedBook
  })
}

/**
 * Enriquece libros con datos de Google Books API
 * Solo para libros NO en colección (para mostrar mejor portada)
 */
async function enrichWithGoogleBooks(
  books: EnrichedDetectedBook[]
): Promise<EnrichedDetectedBook[]> {
  const enriched = await Promise.all(
    books.map(async book => {
      // Solo enriquecer si NO está en colección
      if (book.inCollection) {
        return book
      }

      try {
        // Buscar en Google Books
        const query = book.isbn
          ? `isbn:${book.isbn}`
          : `${book.title} ${book.author || ''}`.trim()

        const googleData = await searchGoogleBooks(query)

        if (googleData) {
          return {
            ...book,
            googleBooksData: {
              coverUrl: googleData.coverUrl,
              publisher: googleData.publisher,
              year: googleData.year,
              category: googleData.category,
              isbn: googleData.isbn || book.isbn,
            },
          }
        }
      } catch (error) {
        console.error(`Failed to enrich book "${book.title}":`, error)
      }

      return book
    })
  )

  return enriched
}

// ============================================================================
// UTILIDADES DE FUZZY MATCHING
// ============================================================================

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s]/g, '') // Solo alfanuméricos
    .trim()
}

/**
 * Calcula similitud entre dos strings usando Levenshtein distance
 * Retorna valor entre 0 (sin similitud) y 1 (idénticos)
 */
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) return 1.0

  const distance = levenshteinDistance(longer, shorter)
  return (longer.length - distance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

/**
 * Crea múltiples libros en batch
 */
export async function addMultipleBooksToShelf(
  books: Array<{
    title: string
    author?: string
    isbn?: string
    coverUrl?: string
    publisher?: string
    year?: number
    category?: string
    language?: string
    sourceTags?: string[]
  }>,
  shelfId: string
) {
  try {
    const user = await requireAuth()

    // Verificar que el shelf pertenece al usuario
    const shelf = await prisma.shelf.findFirst({
      where: {
        id: shelfId,
        library: {
          userId: user.id as string,
        },
      },
    })

    if (!shelf) {
      return {
        success: false,
        error: 'Shelf not found or unauthorized',
      }
    }

    // Crear libros individualmente (createMany no soporta relations)
    const created = await Promise.all(
      books.map(book => {
        // Tags de fuentes con prefijo
        const sourceTags = (book.sourceTags || ['shelf_scan'])
          .map(s => createSourceTag(s))

        return prisma.book.create({
          data: {
            title: book.title,
            author: book.author || 'Unknown',
            isbn: book.isbn,
            coverUrl: book.coverUrl,
            publisher: book.publisher,
            year: book.year,
            category: book.category,
            language: book.language,
            shelfId,
            rating: 0,
            readStatus: 'WANT_TO_READ',
            metadataSource: 'ai_shelf_scan',
            tags: {
              connectOrCreate: sourceTags.map(tagName => ({
                where: { name: tagName },
                create: { name: tagName },
              })),
            },
          },
        })
      })
    )

    return {
      success: true,
      count: created.length,
    }
  } catch (error) {
    console.error('[AddMultipleBooks] Error:', error)
    return {
      success: false,
      error: 'Failed to add books',
    }
  }
}
