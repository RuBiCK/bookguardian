'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Book, Lending, Tag } from '@prisma/client'
import { ArrowLeft, Star, Calendar, User, BookOpen, Library, ChevronDown, CheckCircle2, Users, Hash, Building2, Tag as TagIcon, CalendarPlus, Sparkles } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { separateTags, formatSourceName } from '@/lib/source-tags'
import InlineEdit from '@/components/InlineEdit'
import TagInput from '@/components/TagInput'

type BookWithLending = Book & {
    lendings: Lending[]
    tags: Tag[]
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
        tags: [] as string[]
    })
    const [tagSuggestions, setTagSuggestions] = useState<{ name: string; count: number }[]>([])
    const [showStatusDropdown, setShowStatusDropdown] = useState(false)
    const [showLendingInput, setShowLendingInput] = useState(false)
    const [libraries, setLibraries] = useState<any[]>([])
    const [selectedLibrary, setSelectedLibrary] = useState('')
    const [showLibraryShelfDropdown, setShowLibraryShelfDropdown] = useState(false)

    useEffect(() => {
        async function fetchBook() {
            try {
                const res = await fetch(`/api/books/${params.id}`)
                if (!res.ok) throw new Error('Book not found')
                const data = await res.json()
                setBook(data)
                // Initialize edit form - only include user tags, not source tags
                const { userTags } = separateTags(data.tags || [])
                setEditForm({
                    title: data.title,
                    author: data.author,
                    year: data.year ? String(data.year) : '',
                    readStatus: data.readStatus,
                    rating: data.rating ? String(data.rating) : '0',
                    comment: data.comment || '',
                    tags: userTags.map((t: any) => t.name)
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

    useEffect(() => {
        async function fetchTags() {
            try {
                const res = await fetch('/api/tags')
                if (res.ok) {
                    setTagSuggestions(await res.json())
                }
            } catch (error) {
                console.error('Error loading tags:', error)
            }
        }
        fetchTags()
    }, [])

    useEffect(() => {
        async function fetchLibraries() {
            try {
                const res = await fetch('/api/libraries')
                if (res.ok) {
                    const data = await res.json()
                    setLibraries(data)
                }
            } catch (error) {
                console.error('Error loading libraries:', error)
            }
        }
        fetchLibraries()
    }, [])

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
                setShowLendingInput(false)
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

    const handleStatusChange = async (newStatus: string) => {
        if (!book) return
        try {
            const res = await fetch(`/api/books/${book.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ readStatus: newStatus })
            })

            if (res.ok) {
                const updatedBook = await res.json()
                setBook(updatedBook)
                setShowStatusDropdown(false)
            }
        } catch (error) {
            console.error('Error updating status:', error)
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
                    tags: editForm.tags.filter(Boolean)
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

    const handleInlineUpdate = async (field: string, value: string) => {
        if (!book) return
        try {
            const res = await fetch(`/api/books/${book.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value }),
            })
            if (res.ok) {
                const updatedData = await res.json()
                setBook(updatedData)
            }
        } catch (error) {
            console.error(`Error updating ${field}:`, error)
            throw error
        }
    }

    const handleShelfChange = async (shelfId: string) => {
        if (!book) return
        try {
            const res = await fetch(`/api/books/${book.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shelfId }),
            })
            if (res.ok) {
                const updatedData = await res.json()
                setBook(updatedData)
                setShowLibraryShelfDropdown(false)
            }
        } catch (error) {
            console.error('Error updating shelf:', error)
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
                        <TagInput
                            value={editForm.tags}
                            onChange={(tags) => setEditForm({ ...editForm, tags })}
                            suggestions={tagSuggestions}
                            placeholder="Add a tag..."
                        />
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
                            <h1 className="text-3xl font-bold leading-tight">
                                <InlineEdit
                                    value={book.title}
                                    onSave={(value) => handleInlineUpdate('title', value)}
                                    className="text-3xl font-bold"
                                    placeholder="Book title"
                                />
                            </h1>
                            <div className="text-xl text-muted-foreground mt-2">
                                <InlineEdit
                                    value={book.author}
                                    onSave={(value) => handleInlineUpdate('author', value)}
                                    className="text-xl text-muted-foreground"
                                    placeholder="Author name"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            {/* First row: Rating, Published, Added, ISBN */}
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                                {(book.rating || 0) > 0 && (
                                    <div className="flex items-center gap-1.5 text-yellow-500 font-medium">
                                        <Star size={16} fill="currentColor" />
                                        <span>{book.rating}/5</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 text-muted-foreground" title="Publication year">
                                    <Calendar size={16} />
                                    <span>Published: </span>
                                    <span className="inline-block" style={{ maxWidth: '80px' }}>
                                        <InlineEdit
                                            value={book.year?.toString() || ''}
                                            onSave={(value) => handleInlineUpdate('year', value)}
                                            className="text-sm text-muted-foreground w-full"
                                            placeholder="Year"
                                        />
                                    </span>
                                </div>
                                {book.createdAt && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground" title="Date added to library">
                                        <CalendarPlus size={16} />
                                        <span>Added: {new Date(book.createdAt).toLocaleDateString()}</span>
                                    </div>
                                )}
                                {book.isbn && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Hash size={16} />
                                        <span>ISBN: {book.isbn}</span>
                                    </div>
                                )}
                            </div>

                            {/* Second row: Publisher, Category, Library/Shelf, Status */}
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                                {book.publisher && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Building2 size={16} />
                                        <span>{book.publisher}</span>
                                    </div>
                                )}
                                {book.category && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <TagIcon size={16} />
                                        <span>{book.category}</span>
                                    </div>
                                )}
                                {/* Library and Shelf - Clickable Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowLibraryShelfDropdown(!showLibraryShelfDropdown)}
                                        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
                                        title="Click to change library/shelf"
                                    >
                                        <Library size={16} />
                                        <span>
                                            {(book as any).shelf?.library?.name} / {(book as any).shelf?.name}
                                        </span>
                                        <ChevronDown size={14} />
                                    </button>

                                    {showLibraryShelfDropdown && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setShowLibraryShelfDropdown(false)}
                                            />
                                            <div className="absolute top-full mt-1 left-0 bg-white dark:bg-neutral-800 border border-border rounded-lg shadow-lg py-2 z-50 min-w-[280px] max-h-[400px] overflow-y-auto">
                                                {libraries.map(library => (
                                                    <div key={library.id}>
                                                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                            {library.name}
                                                        </div>
                                                        {library.shelves?.map((shelf: any) => (
                                                            <button
                                                                key={shelf.id}
                                                                onClick={() => handleShelfChange(shelf.id)}
                                                                className={`w-full px-4 py-2 text-left text-sm hover:bg-secondary transition-colors ${
                                                                    (book as any).shelf?.id === shelf.id ? 'bg-secondary font-medium' : ''
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2
                                                                        size={14}
                                                                        className={`${
                                                                            (book as any).shelf?.id === shelf.id
                                                                                ? 'text-primary'
                                                                                : 'text-transparent'
                                                                        }`}
                                                                    />
                                                                    {shelf.name}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                {/* Reading Status - Clickable Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                                        className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors flex items-center gap-1"
                                    >
                                        {book.readStatus.replace(/_/g, ' ')}
                                        <ChevronDown size={14} />
                                    </button>

                                    {showStatusDropdown && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setShowStatusDropdown(false)}
                                            />
                                            <div className="absolute top-full mt-1 left-0 bg-white dark:bg-neutral-800 border border-border rounded-lg shadow-lg py-1 z-50 min-w-[150px]">
                                                {['WANT_TO_READ', 'READING', 'READ'].map(status => (
                                                    <button
                                                        key={status}
                                                        onClick={() => handleStatusChange(status)}
                                                        className={`w-full px-3 py-2 text-left text-sm hover:bg-secondary transition-colors ${
                                                            book.readStatus === status ? 'bg-secondary font-medium' : ''
                                                        }`}
                                                    >
                                                        {status.replace(/_/g, ' ')}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tags Display - Separar user tags de source tags */}
                        {book.tags && book.tags.length > 0 && (() => {
                            const { userTags, sourceTags } = separateTags(book.tags)

                            return (
                                <div className="space-y-3">
                                    {/* Source Tags */}
                                    {sourceTags.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
                                                <span className="text-xs font-semibold text-muted-foreground">
                                                    Sources
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {sourceTags.map((tag: any) => (
                                                    <span
                                                        key={tag.id}
                                                        className="px-2 py-1 rounded-md bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900 dark:to-blue-900 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700 text-xs font-medium"
                                                    >
                                                        {formatSourceName(tag.name)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* User Tags */}
                                    {userTags.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {userTags.map((tag: any) => (
                                                <span
                                                    key={tag.id}
                                                    className="px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-sm"
                                                >
                                                    {tag.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })()}

                        <div className="p-4 bg-secondary/50 rounded-lg italic text-muted-foreground">
                            <InlineEdit
                                value={book.comment || ''}
                                onSave={(value) => handleInlineUpdate('comment', value)}
                                className="text-muted-foreground italic"
                                placeholder="Add notes or comments..."
                                multiline={true}
                                singleClick={true}
                            />
                        </div>

                        <div className="border-t border-border pt-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Users size={20} />
                                Lending Status
                            </h3>

                            {currentLending ? (
                                // Book is currently lent out
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                        <User size={20} className="text-blue-600 dark:text-blue-400" />
                                        <div className="flex-1">
                                            <p className="font-medium text-blue-900 dark:text-blue-100">
                                                Lent to {currentLending.borrowerName}
                                            </p>
                                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                                Since {new Date(currentLending.lentDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleReturn(currentLending.id)}
                                        className="w-full btn-secondary"
                                    >
                                        Mark as Returned
                                    </button>
                                </div>
                            ) : showLendingInput ? (
                                // Show borrower input form
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Borrower Name</label>
                                        <input
                                            type="text"
                                            value={lendingName}
                                            onChange={(e) => setLendingName(e.target.value)}
                                            placeholder="Enter borrower name"
                                            className="input-field"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setShowLendingInput(false)
                                                setLendingName('')
                                            }}
                                            className="flex-1 btn-secondary"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleLend}
                                            disabled={!lendingName.trim() || isLending}
                                            className="flex-1 btn-primary"
                                        >
                                            {isLending ? 'Lending...' : 'Confirm Lending'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Book is available
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                        <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />
                                        <p className="font-medium text-green-900 dark:text-green-100">
                                            This book is currently available
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowLendingInput(true)}
                                        className="w-full btn-primary"
                                    >
                                        Lend This Book
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
