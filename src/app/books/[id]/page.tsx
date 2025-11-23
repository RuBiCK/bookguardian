'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Book, Lending } from '@prisma/client'
import { ArrowLeft, Star, Calendar, User, BookOpen } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

type BookWithLending = Book & {
    lendings: Lending[]
}

export default function BookDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const [book, setBook] = useState<BookWithLending | null>(null)
    const [loading, setLoading] = useState(true)
    const [lendingName, setLendingName] = useState('')
    const [isLending, setIsLending] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState({
        title: '',
        author: '',
        year: '',
        readStatus: '',
        rating: '',
        comment: '',
        tags: ''
    })

    useEffect(() => {
        async function fetchBook() {
            try {
                const res = await fetch(`/api/books/${params.id}`)
                if (!res.ok) throw new Error('Book not found')
                const data = await res.json()
                setBook(data)
                // Initialize edit form
                setEditForm({
                    title: data.title,
                    author: data.author,
                    year: data.year ? String(data.year) : '',
                    readStatus: data.readStatus,
                    rating: data.rating ? String(data.rating) : '0',
                    comment: data.comment || '',
                    tags: data.tags ? data.tags.map((t: any) => t.name).join(', ') : ''
                })
            } catch (error) {
                console.error(error)
                router.push('/')
            } finally {
                setLoading(false)
            }
        }
        fetchBook()
    }, [params.id, router])

    const handleLend = async () => {
        if (!lendingName || !book) return
        setIsLending(true)
        try {
            const res = await fetch('/api/lending', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookId: book.id,
                    borrowerName: lendingName,
                }),
            })
            if (res.ok) {
                // Refresh book data
                const updatedRes = await fetch(`/api/books/${params.id}`)
                const updatedData = await updatedRes.json()
                setBook(updatedData)
                setLendingName('')
            }
        } catch (error) {
            console.error('Error lending book:', error)
        } finally {
            setIsLending(false)
        }
    }

    const handleReturn = async (lendingId: string) => {
        try {
            const res = await fetch('/api/lending', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lendingId, status: 'RETURNED' }),
            })
            if (res.ok) {
                const updatedRes = await fetch(`/api/books/${params.id}`)
                const updatedData = await updatedRes.json()
                setBook(updatedData)
            }
        } catch (error) {
            console.error('Error returning book:', error)
        }
    }

    const handleUpdate = async () => {
        if (!book) return
        try {
            const res = await fetch(`/api/books/${book.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editForm,
                    tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean)
                }),
            })
            if (res.ok) {
                const updatedData = await res.json()
                setBook(updatedData)
                setIsEditing(false)
            }
        } catch (error) {
            console.error('Error updating book:', error)
        }
    }

    if (loading) return <div className="p-8 text-center">Loading...</div>
    if (!book) return null

    const currentLending = book.lendings?.find((l: any) => l.status === 'LENT')

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft size={16} className="mr-1" />
                    Back to Library
                </Link>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                >
                    {isEditing ? 'Cancel Edit' : 'Edit Book'}
                </button>
            </div>

            {isEditing ? (
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
                    <h2 className="text-xl font-bold mb-4">Edit Book Details</h2>

                    <div>
                        <label className="block text-sm font-medium mb-1">Title</label>
                        <input
                            value={editForm.title}
                            onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Author</label>
                        <input
                            value={editForm.author}
                            onChange={e => setEditForm({ ...editForm, author: e.target.value })}
                            className="input-field"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Year</label>
                            <input
                                type="number"
                                value={editForm.year}
                                onChange={e => setEditForm({ ...editForm, year: e.target.value })}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Rating</label>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setEditForm({ ...editForm, rating: star.toString() })}
                                        className="focus:outline-none transition-transform hover:scale-110"
                                    >
                                        <Star
                                            size={28}
                                            className={`${parseInt(editForm.rating || '0') >= star
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-muted-foreground/30'
                                                } transition-colors`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <select
                            value={editForm.readStatus}
                            onChange={e => setEditForm({ ...editForm, readStatus: e.target.value })}
                            className="input-field"
                        >
                            <option value="WANT_TO_READ">Want to Read</option>
                            <option value="READING">Reading</option>
                            <option value="READ">Read</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Tags</label>
                        <input
                            value={editForm.tags}
                            onChange={e => setEditForm({ ...editForm, tags: e.target.value })}
                            placeholder="Comma separated tags"
                            className="input-field"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Separate tags with commas</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Notes</label>
                        <textarea
                            value={editForm.comment}
                            onChange={e => setEditForm({ ...editForm, comment: e.target.value })}
                            className="input-field min-h-[100px]"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 rounded-lg border border-border hover:bg-secondary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpdate}
                            className="btn-primary"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid md:grid-cols-[300px_1fr] gap-8">
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl shadow-lg">
                        {book.coverUrl ? (
                            <Image src={book.coverUrl} alt={book.title} fill className="object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                                <BookOpen size={48} />
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl font-bold leading-tight">{book.title}</h1>
                            <p className="text-xl text-muted-foreground mt-2">{book.author}</p>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            {(book.rating || 0) > 0 && (
                                <div className="flex items-center text-yellow-500 font-medium">
                                    <Star size={20} fill="currentColor" className="mr-1" />
                                    {book.rating}/5
                                </div>
                            )}
                            <div className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                                {book.readStatus.replace(/_/g, ' ')}
                            </div>
                            {book.year && (
                                <div className="flex items-center text-muted-foreground">
                                    <Calendar size={18} className="mr-1" />
                                    {book.year}
                                </div>
                            )}
                        </div>

                        {/* Tags Display */}
                        {book.tags && book.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {book.tags.map((tag: any) => (
                                    <span key={tag.id} className="px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-sm">
                                        {tag.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {book.comment && (
                            <div className="p-4 bg-secondary/50 rounded-lg italic text-muted-foreground">
                                "{book.comment}"
                            </div>
                        )}

                        <div className="border-t border-border pt-6">
                            <h3 className="text-lg font-semibold mb-4">Lending Status</h3>

                            {currentLending ? (
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-600 dark:text-blue-200">
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-blue-900 dark:text-blue-100">Lent to {currentLending.borrowerName}</p>
                                            <p className="text-xs text-blue-700 dark:text-blue-300">Since {new Date(currentLending.lentDate).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleReturn(currentLending.id)}
                                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Mark as Returned
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">This book is currently available.</p>
                                    <div className="flex gap-2">
                                        <input
                                            placeholder="Borrower Name"
                                            className="input-field"
                                            value={lendingName}
                                            onChange={(e) => setLendingName(e.target.value)}
                                        />
                                        <button
                                            onClick={handleLend}
                                            disabled={!lendingName || isLending}
                                            className="btn-primary whitespace-nowrap"
                                        >
                                            Lend Book
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
