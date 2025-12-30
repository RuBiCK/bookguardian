'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Search, Loader2, X, CheckCircle2 } from 'lucide-react'
import { createSourceTag } from '@/lib/source-tags'

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
    const [loading, setLoading] = useState(false)
    const [searching, setSearching] = useState(false)
    const [searchError, setSearchError] = useState('')
    const [libraries, setLibraries] = useState<Library[]>([])
    const [selectedLibrary, setSelectedLibrary] = useState('')
    const [selectedShelf, setSelectedShelf] = useState('')
    const [usedSearch, setUsedSearch] = useState(false)
    const [multipleOptions, setMultipleOptions] = useState<BookOption[]>([])
    const [initialSourceTags, setInitialSourceTags] = useState<string[]>([])
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
        tags: ''
    })

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
            tags: ''
        })
        setUsedSearch(false)
        setMultipleOptions([])
        setInitialSourceTags([])
    }

    const handleSubmit = async (e: React.FormEvent, mode: 'return' | 'addMore' = 'return') => {
        e.preventDefault()
        setLoading(true)
        try {
            // Combinar tags de usuario con tags de fuentes
            const userTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean)

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
                if (mode === 'addMore') {
                    // Stay on page, clear form, keep library/shelf
                    resetFormData()
                } else if (onSaveSuccess) {
                    // Callback mode: call the success handler
                    onSaveSuccess()
                } else {
                    // Original behavior: redirect to library
                    router.push('/library')
                    router.refresh()
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

            <div className="grid grid-cols-2 gap-4">
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
                {!hideNavigation ? (
                    <>
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
                            type="button"
                            onClick={(e) => handleSubmit(e, 'addMore')}
                            disabled={loading}
                            className="flex-1 btn-secondary"
                        >
                            {loading ? 'Adding...' : 'Save & Add More'}
                        </button>
                        <button
                            type="submit"
                            onClick={(e) => handleSubmit(e, 'return')}
                            disabled={loading}
                            className="flex-1 btn-primary"
                        >
                            {loading ? 'Adding...' : 'Add Book'}
                        </button>
                    </>
                ) : (
                    <button
                        type="submit"
                        onClick={(e) => handleSubmit(e, 'return')}
                        disabled={loading}
                        className="w-full btn-primary"
                    >
                        {loading ? 'Saving...' : 'Save Book'}
                    </button>
                )}
            </div>
        </form>
    )
}
