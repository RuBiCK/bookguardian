'use client'

import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AddBookISBNProps {
    onScanComplete: (data: any) => void
}

export default function AddBookISBN({ onScanComplete }: AddBookISBNProps) {
    const router = useRouter()
    const [isbn, setIsbn] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isbn) return

        setLoading(true)
        setError('')

        try {
            // Fetch from Google Books API
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
            const data = await res.json()

            if (data.totalItems > 0) {
                const bookInfo = data.items[0].volumeInfo

                // Map to our format
                const newBook = {
                    title: bookInfo.title,
                    author: bookInfo.authors ? bookInfo.authors.join(', ') : 'Unknown',
                    isbn: isbn,
                    coverUrl: bookInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
                    category: bookInfo.categories ? bookInfo.categories[0] : undefined,
                    year: bookInfo.publishedDate ? parseInt(bookInfo.publishedDate.substring(0, 4)) : undefined,
                    publisher: bookInfo.publisher,
                    language: bookInfo.language,
                    readStatus: 'WANT_TO_READ'
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
            <form onSubmit={handleSearch} className="relative">
                <input
                    type="text"
                    placeholder="Enter ISBN (e.g. 9780140328721)"
                    className="input-field pr-12"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                />
                <button
                    type="submit"
                    disabled={loading || !isbn}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </button>
            </form>

            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                    {error}
                </div>
            )}

            <div className="text-center text-xs text-muted-foreground">
                Supports ISBN-10 and ISBN-13
            </div>
        </div>
    )
}
