'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Search, Loader2 } from 'lucide-react'

interface AddBookManualProps {
    initialData?: {
        title?: string
        author?: string
        isbn?: string
        category?: string
        publisher?: string
        year?: string
        language?: string
    }
}

export default function AddBookManual({ initialData }: AddBookManualProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [searching, setSearching] = useState(false)
    const [searchError, setSearchError] = useState('')
    const [formData, setFormData] = useState({
        title: initialData?.title || '',
        author: initialData?.author || '',
        isbn: initialData?.isbn || '',
        category: initialData?.category || '',
        publisher: initialData?.publisher || '',
        year: initialData?.year ? String(initialData.year) : '',
        language: initialData?.language || '',
        readStatus: 'WANT_TO_READ',
        rating: '0',
        comment: '',
        tags: ''
    })

    // Update form data if initialData changes
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                title: initialData.title || prev.title,
                author: initialData.author || prev.author,
                isbn: initialData.isbn || prev.isbn,
                category: initialData.category || prev.category,
                publisher: initialData.publisher || prev.publisher,
                year: initialData.year ? String(initialData.year) : prev.year,
                language: initialData.language || prev.language,
            }))
        }
    }, [initialData])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSearch = async () => {
        if (!formData.title) {
            setSearchError('Please enter a title to search')
            return
        }

        setSearching(true)
        setSearchError('')

        try {
            // Build search query: title + author if provided
            let query = `intitle:${formData.title}`
            if (formData.author) {
                query += `+inauthor:${formData.author}`
            }

            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`)
            const data = await res.json()

            if (data.totalItems > 0) {
                const bookInfo = data.items[0].volumeInfo

                // Update form with found data, preserving user input where it exists
                setFormData(prev => ({
                    ...prev,
                    title: bookInfo.title || prev.title,
                    author: bookInfo.authors ? bookInfo.authors.join(', ') : prev.author,
                    isbn: bookInfo.industryIdentifiers?.[0]?.identifier || prev.isbn,
                    category: bookInfo.categories ? bookInfo.categories[0] : prev.category,
                    publisher: bookInfo.publisher || prev.publisher,
                    year: bookInfo.publishedDate ? bookInfo.publishedDate.substring(0, 4) : prev.year,
                    language: bookInfo.language || prev.language,
                }))
            } else {
                setSearchError('No results found. Try a different search.')
            }
        } catch (err) {
            console.error(err)
            setSearchError('Error searching for book.')
        } finally {
            setSearching(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch('/api/books', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
                }),
            })
            if (res.ok) {
                router.push('/library')
                router.refresh()
            }
        } catch (error) {
            console.error('Error adding book:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input required name="title" value={formData.title} placeholder="Book Title" className="input-field" onChange={handleChange} />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Author</label>
                <input name="author" value={formData.author} placeholder="Author Name" className="input-field" onChange={handleChange} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">ISBN</label>
                    <input name="isbn" value={formData.isbn} placeholder="Optional" className="input-field" onChange={handleChange} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Year</label>
                    <input name="year" value={formData.year} type="number" placeholder="YYYY" className="input-field" onChange={handleChange} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <input name="category" value={formData.category} placeholder="Fiction, Sci-Fi..." className="input-field" onChange={handleChange} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Language</label>
                    <input name="language" value={formData.language} placeholder="EN, ES..." className="input-field" onChange={handleChange} />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select name="readStatus" value={formData.readStatus} className="input-field" onChange={handleChange}>
                    <option value="WANT_TO_READ">Want to Read</option>
                    <option value="READING">Reading</option>
                    <option value="READ">Read</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Rating</label>
                <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onClick={() => setFormData({ ...formData, rating: star.toString() })}
                            className="focus:outline-none transition-transform hover:scale-110"
                        >
                            <Star
                                size={28}
                                className={`${parseInt(formData.rating || '0') >= star
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-muted-foreground/30'
                                    } transition-colors`}
                            />
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                    name="comment"
                    value={formData.comment}
                    className="input-field min-h-[100px]"
                    placeholder="Add your personal notes here..."
                    onChange={handleChange}
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Tags</label>
                <input
                    name="tags"
                    value={formData.tags}
                    placeholder="Comma separated tags (e.g. sci-fi, favorite)"
                    className="input-field"
                    onChange={handleChange}
                />
                <p className="text-xs text-muted-foreground mt-1">Separate tags with commas</p>
            </div>

            {searchError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                    {searchError}
                </div>
            )}

            <div className="flex gap-3 mt-6">
                <button
                    type="button"
                    onClick={handleSearch}
                    disabled={searching || !formData.title}
                    className="flex-1 btn-secondary flex items-center justify-center gap-2"
                >
                    {searching ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Searching...
                        </>
                    ) : (
                        <>
                            <Search size={18} />
                            Search
                        </>
                    )}
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 btn-primary"
                >
                    {loading ? 'Adding...' : 'Add Book'}
                </button>
            </div>
        </form>
    )
}
