'use server'

import { getAIProvider } from '@/lib/ai/factory'
import { searchGoogleBooks, searchGoogleBooksMultiple } from './google-books'

export async function analyzeBookImage(base64Image: string) {
    try {
        // Usar el nuevo sistema pluggable
        const aiProvider = getAIProvider()
        console.log(`Analyzing image with ${aiProvider.name}...`)

        const aiData = await aiProvider.analyzeSingleBook(base64Image, {
            compressionQuality: 0.8,
        })

        // Search for multiple editions with Google Books
        let multipleResults: Awaited<ReturnType<typeof searchGoogleBooksMultiple>> = []

        // Try to search by ISBN first
        if (aiData.isbn) {
            multipleResults = await searchGoogleBooksMultiple(`isbn:${aiData.isbn}`)
        }
        // If no ISBN or no results, try Title + Author
        if (multipleResults.length === 0 && aiData.title) {
            const query = `${aiData.title} ${aiData.author || ''}`.trim()
            multipleResults = await searchGoogleBooksMultiple(query)
        }

        // If we found multiple results, return them for user selection
        if (multipleResults.length > 1) {
            return {
                data: aiData,
                multipleOptions: multipleResults,
                sourceTags: ['google_books'], // Used Google Books for multiple options
            }
        }

        // If only one result or no results, use the old behavior
        let enrichedData = { ...aiData }
        let usedGoogleBooks = false

        if (multipleResults.length === 1) {
            enrichedData = { ...enrichedData, ...multipleResults[0] }
            usedGoogleBooks = true
        } else {
            // Fallback to single search if no multiple results
            if (aiData.isbn) {
                const googleData = await searchGoogleBooks(`isbn:${aiData.isbn}`)
                if (googleData) {
                    enrichedData = { ...enrichedData, ...googleData }
                    usedGoogleBooks = true
                }
            } else if (aiData.title) {
                const query = `${aiData.title} ${aiData.author || ''}`.trim()
                const googleData = await searchGoogleBooks(query)
                if (googleData) {
                    enrichedData = { ...enrichedData, ...googleData }
                    usedGoogleBooks = true
                }
            }
        }

        return {
            data: enrichedData,
            sourceTags: usedGoogleBooks ? ['google_books'] : [], // AI tag se añade en componente
        }
    } catch (error) {
        console.error("AI Provider Error:", error)
        return { error: 'Failed to analyze image. Please try again.' }
    }
}
