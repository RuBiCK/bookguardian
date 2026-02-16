'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Search, Loader2, X, CheckCircle2, ChevronDown, Check } from 'lucide-react'
import { createSourceTag } from '@/lib/source-tags'
import TagInput from '@/components/TagInput'
import Toast from '@/components/Toast'

const STORAGE_KEY_LIBRARY = 'bookForm_lastLibraryId'
const STORAGE_KEY_SHELF = 'bookForm_lastShelfId'

interface BookOption {
    title: string
    author?: string
    isbn?: string
    coverUrl?: string
    category?: string
    year?: string
    publisher?: string
    language?: string
}

interface AddBookManualProps {
    initialData?: {
        title?: string
        author?: string
        isbn?: string
        coverUrl?: string
        category?: string
        publisher?: string
        year?: string
        language?: string
        sourceTags?: string[]
    }
    defaultShelfId?: string
    onSaveSuccess?: () => void
    hideNavigation?: boolean
}

interface Library {
    id: string
    name: string
    shelves: { id: string; name: string }[]
}

export default function AddBookManual({ initialData, defaultShelfId, onSaveSuccess, hideNavigation }: AddBookManualProps) {
    const router = useRouter()
    const titleInputRef = useRef<HTMLInputElement>(null)
    const [loading, setLoading] = useState(false)
    const [searching, setSearching] = useState(false)
    const [searchError, setSearchError] = useState('')
    const [libraries, setLibraries] = useState<Library[]>([])
    const [selectedLibrary, setSelectedLibrary] = useState('')
    const [selectedShelf, setSelectedShelf] = useState('')
    const [usedSearch, setUsedSearch] = useState(false)
    const [multipleOptions, setMultipleOptions] = useState<BookOption[]>([])
    const [initialSourceTags, setInitialSourceTags] = useState<string[]>([])
    const [tagSuggestions, setTagSuggestions] = useState<{ name: string; count: number }[]>([])
    const [showDetails, setShowDetails] = useState(false)
    const [booksAddedCount, setBooksAddedCount] = useState(0)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
    const [formData, setFormData] = useState({
        title: initialData?.title || '',
        author: initialData?.author || '',
        isbn: initialData?.isbn || '',
        coverUrl: initialData?.coverUrl || '',
        category: initialData?.category || '',
        publisher: initialData?.publisher || '',
        year: initialData?.year ? String(initialData.year) : '',
        language: initialData?.language || '',
        readStatus: 'WANT_TO_READ',
        rating: '0',
        comment: '',
        tags: [] as string[]
    })

    // Load tags on mount
    useEffect(() => {
        const fetchTags = async () => {
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

    // Load libraries on mount
    useEffect(() => {
        const fetchLibraries = async () => {
            try {
                const res = await fetch('/api/libraries')
                if (res.ok) {
                    const data = await res.json()
                    setLibraries(data)

                    // Try to restore from localStorage
                    const savedLibraryId = localStorage.getItem(STORAGE_KEY_LIBRARY)
                    const savedShelfId = localStorage.getItem(STORAGE_KEY_SHELF)

                    // If defaultShelfId provided, use it
                    if (defaultShelfId) {
                        setSelectedShelf(defaultShelfId)
                        const lib = data.find((lib: Library) =>
                            lib.shelves?.find((s: { id: string }) => s.id === defaultShelfId)
                        )
                        if (lib) {
                            setSelectedLibrary(lib.id)
                        }
                    } else if (savedLibraryId && data.find((lib: Library) => lib.id === savedLibraryId)) {
                        setSelectedLibrary(savedLibraryId)
                        const lib = data.find((lib: Library) => lib.id === savedLibraryId)
                        if (savedShelfId && lib && lib.shelves?.find((s: { id: string; name: string }) => s.id === savedShelfId)) {
                            setSelectedShelf(savedShelfId)
                        } else if (lib && lib.shelves?.length > 0) {
                            setSelectedShelf(lib.shelves[0].id)
                        }
                    } else {
                        // Fallback to first library/shelf
                        if (data.length > 0) {
                            setSelectedLibrary(data[0].id)
                            if (data[0].shelves?.length > 0) {
                                setSelectedShelf(data[0].shelves[0].id)
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading libraries:', error)
            }
        }
        fetchLibraries()
    }, [defaultShelfId])

    // Update form data if initialData changes
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                title: initialData.title || prev.title,
                author: initialData.author || prev.author,
                isbn: initialData.isbn || prev.isbn,
                coverUrl: initialData.coverUrl || prev.coverUrl,
                category: initialData.category || prev.category,
                publisher: initialData.publisher || prev.publisher,
                year: initialData.year ? String(initialData.year) : prev.year,
                language: initialData.language || prev.language,
            }))
            // If we received initial data (from ISBN/Camera scan), save source tags
            if (initialData.sourceTags && initialData.sourceTags.length > 0) {
                setInitialSourceTags(initialData.sourceTags)
                setUsedSearch(true)
                setShowDetails(true)
            }
        }
    }, [initialData])

    // Save library selection to localStorage
    useEffect(() => {
        if (selectedLibrary) {
            localStorage.setItem(STORAGE_KEY_LIBRARY, selectedLibrary)
        }
    }, [selectedLibrary])

    // Save shelf selection to localStorage
    useEffect(() => {
        if (selectedShelf) {
            localStorage.setItem(STORAGE_KEY_SHELF, selectedShelf)
        }
    }, [selectedShelf])

    // Update shelf options when library changes
    const handleLibraryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const libId = e.target.value
        setSelectedLibrary(libId)
        const library = libraries.find(lib => lib.id === libId)
        if (library && library.shelves && library.shelves.length > 0) {
            setSelectedShelf(library.shelves[0].id)
        } else {
            setSelectedShelf('')
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const detailFieldCount = [formData.isbn, formData.year, formData.category, formData.language, formData.rating !== '0' ? formData.rating : '', formData.comment].filter(Boolean).length

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
                // Map all results (limit to 10)
                const options: BookOption[] = data.items.slice(0, 10).map((item: any) => ({
                    title: item.volumeInfo.title || '',
                    author: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : undefined,
                    isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier,
                    coverUrl: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
                    category: item.volumeInfo.categories?.[0],
                    publisher: item.volumeInfo.publisher,
                    year: item.volumeInfo.publishedDate ? item.volumeInfo.publishedDate.substring(0, 4) : undefined,
                    language: item.volumeInfo.language,
                }))

                // If multiple results, show selection list
                if (options.length > 1) {
                    setMultipleOptions(options)
                } else {
                    // If only one result, fill form directly
                    const bookInfo = options[0]
                    setFormData(prev => ({
                        ...prev,
                        title: bookInfo.title || prev.title,
                        author: bookInfo.author || prev.author,
                        isbn: bookInfo.isbn || prev.isbn,
                        coverUrl: bookInfo.coverUrl || prev.coverUrl,
                        category: bookInfo.category || prev.category,
                        publisher: bookInfo.publisher || prev.publisher,
                        year: bookInfo.year || prev.year,
                        language: bookInfo.language || prev.language,
                    }))
                    setUsedSearch(true)
                    setShowDetails(true)
                }
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

    const handleSelectBook = (selectedBook: BookOption) => {
        // Fill form with selected book data
        setFormData(prev => ({
            ...prev,
            title: selectedBook.title || prev.title,
            author: selectedBook.author || prev.author,
            isbn: selectedBook.isbn || prev.isbn,
            coverUrl: selectedBook.coverUrl || prev.coverUrl,
            category: selectedBook.category || prev.category,
            publisher: selectedBook.publisher || prev.publisher,
            year: selectedBook.year || prev.year,
            language: selectedBook.language || prev.language,
        }))
        setUsedSearch(true)
        setShowDetails(true)
        setMultipleOptions([])
    }

    const resetFormData = () => {
        setFormData({
            title: '',
            author: '',
            isbn: '',
            coverUrl: '',
            category: '',
            publisher: '',
            year: '',
            language: '',
            readStatus: 'WANT_TO_READ',
            rating: '0',
            comment: '',
            tags: []
        })
        setUsedSearch(false)
        setMultipleOptions([])
        setInitialSourceTags([])
        setShowDetails(false)
    }

    const handleSubmit = async (e: React.FormEvent, mode: 'return' | 'addMore' = 'return') => {
        e.preventDefault()
        setLoading(true)
        try {
            // Combinar tags de usuario con tags de fuentes
            const userTags = formData.tags.filter(Boolean)

            // Si hay source tags iniciales (de ISBN/Camera), usar esos
            // Si no, si se usó búsqueda manual, usar manual + google_books
            // Si no, solo manual
            const sourceTags = initialSourceTags.length > 0
                ? initialSourceTags.map(s => createSourceTag(s))
                : usedSearch
                    ? [createSourceTag('manual'), createSourceTag('google_books')]
                    : [createSourceTag('manual')]

            const allTags = [...userTags, ...sourceTags]

            const res = await fetch('/api/books', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    shelfId: selectedShelf || undefined,
                    tags: allTags
                }),
            })
            if (res.ok) {
                const savedTitle = formData.title
                if (mode === 'addMore') {
                    // Stay on page, clear form, keep library/shelf
                    resetFormData()
                    setBooksAddedCount(prev => prev + 1)
                    setToast({ message: `"${savedTitle}" added`, type: 'success' })
                    // Focus back on title input
                    setTimeout(() => titleInputRef.current?.focus(), 100)
                } else if (onSaveSuccess) {
                    // Callback mode: call the success handler
                    onSaveSuccess()
                } else {
                    // Original behavior: redirect to library
                    setToast({ message: `"${savedTitle}" added`, type: 'success' })
                    setTimeout(() => {
                        router.push('/library')
                        router.refresh()
                    }, 600)
                }
            }
        } catch (error) {
            console.error('Error adding book:', error)
        } finally {
            setLoading(false)
        }
    }

    // If showing multiple options, display selection list
    if (multipleOptions.length > 0) {
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Select Book Edition</h3>
                    <button
                        type="button"
                        onClick={() => setMultipleOptions([])}
                        className="p-2 hover:bg-secondary rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <p className="text-sm text-muted-foreground">Multiple editions found. Select the correct one:</p>

                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {multipleOptions.map((book, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => handleSelectBook(book)}
                            className="w-full flex gap-4 p-4 bg-card border border-border rounded-xl hover:bg-secondary/50 transition-all text-left group"
                        >
                            {book.coverUrl && (
                                <img
                                    src={book.coverUrl}
                                    alt={book.title}
                                    className="w-16 h-24 object-cover rounded-lg shadow-sm"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                                    {book.title}
                                </h4>
                                {book.author && (
                                    <p className="text-xs text-muted-foreground mt-1">{book.author}</p>
                                )}
                                <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                                    {book.isbn && (
                                        <span className="px-2 py-1 bg-secondary rounded">ISBN: {book.isbn}</span>
                                    )}
                                    {book.year && (
                                        <span className="px-2 py-1 bg-secondary rounded">{book.year}</span>
                                    )}
                                    {book.publisher && (
                                        <span className="px-2 py-1 bg-secondary rounded truncate max-w-[150px]">{book.publisher}</span>
                                    )}
                                </div>
                            </div>
                            <CheckCircle2 className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" size={24} />
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <>
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Section A: Search (always visible) */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">Title</label>
                        <input
                            ref={titleInputRef}
                            required
                            name="title"
                            value={formData.title}
                            placeholder="Book Title"
                            className="input-field"
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Author</label>
                        <input name="author" value={formData.author} placeholder="Author Name" className="input-field" onChange={handleChange} />
                    </div>

                    {!hideNavigation && (
                        <button
                            type="button"
                            onClick={handleSearch}
                            disabled={searching || !formData.title}
                            className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 border-dashed border-[var(--border)] text-sm font-medium text-muted-foreground hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all disabled:opacity-50"
                        >
                            {searching ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Searching Google Books...
                                </>
                            ) : (
                                <>
                                    <Search size={18} />
                                    Search Google Books
                                </>
                            )}
                        </button>
                    )}

                    {searchError && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                            {searchError}
                        </div>
                    )}
                </div>

                {/* Section B: Book Details (collapsible) */}
                <div className="border border-border rounded-lg overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-secondary/50 transition-colors"
                    >
                        <span>
                            Book Details
                            {detailFieldCount > 0 && (
                                <span className="ml-2 text-xs text-muted-foreground">({detailFieldCount} filled)</span>
                            )}
                        </span>
                        <ChevronDown
                            size={18}
                            className={`text-muted-foreground transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {showDetails && (
                        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1">ISBN</label>
                                    <input name="isbn" value={formData.isbn} placeholder="Optional" className="input-field" onChange={handleChange} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Year</label>
                                    <input name="year" value={formData.year} type="number" placeholder="YYYY" className="input-field" onChange={handleChange} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                <TagInput
                                    value={formData.tags}
                                    onChange={(tags) => setFormData({ ...formData, tags })}
                                    suggestions={tagSuggestions}
                                    placeholder="Add a tag (e.g. sci-fi, favorite)"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Section C: Save Bar (always visible) */}
                <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">Library</label>
                            <select
                                value={selectedLibrary}
                                onChange={handleLibraryChange}
                                className="input-field"
                            >
                                <option value="">Select a library</option>
                                {libraries.map(lib => (
                                    <option key={lib.id} value={lib.id}>{lib.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Shelf</label>
                            <select
                                value={selectedShelf}
                                onChange={(e) => setSelectedShelf(e.target.value)}
                                className="input-field"
                                disabled={!selectedLibrary}
                            >
                                <option value="">Select a shelf</option>
                                {selectedLibrary && libraries.find(lib => lib.id === selectedLibrary)?.shelves?.map(shelf => (
                                    <option key={shelf.id} value={shelf.id}>{shelf.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Status</label>
                            <select name="readStatus" value={formData.readStatus} className="input-field" onChange={handleChange}>
                                <option value="WANT_TO_READ">Want to Read</option>
                                <option value="READING">Reading</option>
                                <option value="READ">Read</option>
                            </select>
                        </div>
                    </div>

                    {booksAddedCount > 0 && (
                        <div className="flex items-center gap-2 text-sm text-[var(--success)] font-medium">
                            <Check size={16} />
                            <span>{booksAddedCount} book{booksAddedCount !== 1 ? 's' : ''} added this session</span>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-3">
                        {!hideNavigation ? (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => handleSubmit(e, 'addMore')}
                                    disabled={loading}
                                    className="flex-1 btn-secondary min-h-[44px]"
                                >
                                    {loading ? 'Adding...' : 'Save & Add Another'}
                                </button>
                                <button
                                    type="submit"
                                    onClick={(e) => handleSubmit(e, 'return')}
                                    disabled={loading}
                                    className="flex-1 btn-primary min-h-[44px]"
                                >
                                    {loading ? 'Adding...' : 'Save & Done'}
                                </button>
                            </>
                        ) : (
                            <button
                                type="submit"
                                onClick={(e) => handleSubmit(e, 'return')}
                                disabled={loading}
                                className="w-full btn-primary min-h-[44px]"
                            >
                                {loading ? 'Saving...' : 'Save Book'}
                            </button>
                        )}
                    </div>
                </div>
            </form>
        </>
    )
}
