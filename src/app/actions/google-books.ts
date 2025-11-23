'use server'

export async function searchGoogleBooks(query: string) {
    try {
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`)
        const data = await res.json()

        if (data.totalItems > 0) {
            const bookInfo = data.items[0].volumeInfo
            return {
                title: bookInfo.title,
                author: bookInfo.authors ? bookInfo.authors.join(', ') : undefined,
                isbn: bookInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier || bookInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_10')?.identifier,
                coverUrl: bookInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
                category: bookInfo.categories ? bookInfo.categories[0] : undefined,
                year: bookInfo.publishedDate ? parseInt(bookInfo.publishedDate.substring(0, 4)) : undefined,
                publisher: bookInfo.publisher,
                language: bookInfo.language,
            }
        }
        return null
    } catch (error) {
        console.error('Google Books Search Error:', error)
        return null
    }
}
