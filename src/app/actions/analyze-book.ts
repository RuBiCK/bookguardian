'use server'

import OpenAI from 'openai'
import { searchGoogleBooks, searchGoogleBooksMultiple } from './google-books'

export async function analyzeBookImage(base64Image: string) {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
        return { error: 'OpenAI API Key is missing. Please add it to your .env file.' }
    }

    const openai = new OpenAI({ apiKey })
    console.log('Analyzing image with OpenAI...')

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this book cover and extract the following information in JSON format: title, author, isbn (if visible), publisher, year (number), category, language (2 letter code). If a field is not visible, return null." },
                        {
                            type: "image_url",
                            image_url: {
                                "url": base64Image,
                            },
                        },
                    ],
                },
            ],
            response_format: { type: "json_object" },
        })

        const content = response.choices[0].message.content
        if (!content) throw new Error("No content in response")

        const aiData = JSON.parse(content)

        // Search for multiple editions with Google Books
        let multipleResults = []

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
            return { data: aiData, multipleOptions: multipleResults }
        }

        // If only one result or no results, use the old behavior
        let enrichedData = { ...aiData }
        if (multipleResults.length === 1) {
            enrichedData = { ...enrichedData, ...multipleResults[0] }
        } else {
            // Fallback to single search if no multiple results
            if (aiData.isbn) {
                const googleData = await searchGoogleBooks(`isbn:${aiData.isbn}`)
                if (googleData) {
                    enrichedData = { ...enrichedData, ...googleData }
                }
            } else if (aiData.title) {
                const query = `${aiData.title} ${aiData.author || ''}`.trim()
                const googleData = await searchGoogleBooks(query)
                if (googleData) {
                    enrichedData = { ...enrichedData, ...googleData }
                }
            }
        }

        return { data: enrichedData }
    } catch (error) {
        console.error("OpenAI Error:", error)
        return { error: 'Failed to analyze image. Please try again.' }
    }
}
