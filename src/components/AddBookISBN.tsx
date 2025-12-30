'use client'

import { useState } from 'react'
import { Search, Loader2, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AddBookISBNProps {
    onScanComplete: (data: any) => void
}

export default function AddBookISBN({ onScanComplete }: AddBookISBNProps) {
    const router = useRouter()
    const [isbn, setIsbn] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [detectedIsbnType, setDetectedIsbnType] = useState<'ISBN-10' | 'ISBN-13' | null>(null)

    // Clean ISBN by removing hyphens, spaces, and other non-alphanumeric characters
    const cleanIsbn = (input: string): string => {
        return input.replace(/[-\s]/g, '').toUpperCase()
    }

    // Detect ISBN type
    const detectIsbnType = (input: string): 'ISBN-10' | 'ISBN-13' | null => {
        const cleaned = cleanIsbn(input)

        // ISBN-13: exactly 13 digits
        if (/^\d{13}$/.test(cleaned)) {
            return 'ISBN-13'
        }

        // ISBN-10: exactly 10 characters (9 digits + optional X)
        if (/^\d{9}[\dX]$/.test(cleaned)) {
            return 'ISBN-10'
        }

        return null
    }

    const handleIsbnChange = (value: string) => {
        setIsbn(value)
        setDetectedIsbnType(detectIsbnType(value))
    }

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isbn) return

        setLoading(true)
        setError('')

        // Clean the ISBN before searching
        const cleanedIsbn = cleanIsbn(isbn)

        try {
            // Fetch from Google Books API with cleaned ISBN
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedIsbn}`)
            const data = await res.json()

            if (data.totalItems > 0) {
                const bookInfo = data.items[0].volumeInfo

                // Map to our format
                const newBook = {
                    title: bookInfo.title,
                    author: bookInfo.authors ? bookInfo.authors.join(', ') : 'Unknown',
                    isbn: cleanedIsbn,
                    coverUrl: bookInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
                    category: bookInfo.categories ? bookInfo.categories[0] : undefined,
                    year: bookInfo.publishedDate ? parseInt(bookInfo.publishedDate.substring(0, 4)) : undefined,
                    publisher: bookInfo.publisher,
                    language: bookInfo.language,
                    readStatus: 'WANT_TO_READ',
                    sourceTags: ['isbn_search', 'google_books']
                }

                onScanComplete(newBook)
            } else {
                setError('Book not found.')
            }
        } catch (err) {
            console.error(err)
            setError('Error searching for book.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <form onSubmit={handleSearch} className="space-y-3">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Enter ISBN (e.g. 978-84-08-30741-9 or 9788408307419)"
                        className="input-field pr-12"
                        value={isbn}
                        onChange={(e) => handleIsbnChange(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={loading || !isbn}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                    </button>
                </div>

                {detectedIsbnType && (
                    <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 size={14} />
                        <span className="font-medium">{detectedIsbnType} detected</span>
                    </div>
                )}
            </form>

            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                    {error}
                </div>
            )}

            <div className="text-center text-xs text-muted-foreground">
                Supports ISBN-10 and ISBN-13 (hyphens will be automatically removed)
            </div>
        </div>
    )
}
