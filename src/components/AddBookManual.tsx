'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'

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
                router.push('/')
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
                <input required name="author" value={formData.author} placeholder="Author Name" className="input-field" onChange={handleChange} />
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

            <button type="submit" disabled={loading} className="w-full btn-primary mt-6">
                {loading ? 'Adding...' : 'Add Book'}
            </button>
        </form>
    )
}
