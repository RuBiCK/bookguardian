'use client'

import { useState, useEffect } from 'react'
import { LayoutGrid, List as ListIcon, Search, BookOpen, Filter, X, Loader2, Star } from 'lucide-react'
import BookCard from '@/components/BookCard'
import { Book, Tag as PrismaTag } from '@prisma/client'

type BookWithTags = Book & {
    tags: PrismaTag[]
}

interface Library {
    id: string
    name: string
}

interface Tag {
    id: string
    name: string
}

export default function Home() {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [books, setBooks] = useState<BookWithTags[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    // Filter State
    const [showFilters, setShowFilters] = useState(false)
    const [libraries, setLibraries] = useState<Library[]>([])
    const [availableTags, setAvailableTags] = useState<Tag[]>([])
    const [filters, setFilters] = useState({
        libraryId: '',
        readStatus: '',
        isLent: '',
        category: '',
        minRating: '',
        tags: ''
    })

    useEffect(() => {
        fetchLibraries()
        fetchTags()
    }, [])

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchBooks()
        }, 300) // Debounce search
        return () => clearTimeout(timeoutId)
    }, [search, filters])

    const fetchLibraries = async () => {
        try {
            const res = await fetch('/api/libraries')
            const data = await res.json()
            setLibraries(data)
        } catch (error) {
            console.error('Failed to fetch libraries', error)
        }
    }

    const fetchTags = async () => {
        try {
            const res = await fetch('/api/tags')
            const data = await res.json()
            setAvailableTags(data)
        } catch (error) {
            console.error('Failed to fetch tags', error)
        }
    }

    const fetchBooks = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.append('search', search)
            if (filters.libraryId) params.append('libraryId', filters.libraryId)
            if (filters.readStatus) params.append('readStatus', filters.readStatus)
            if (filters.isLent) params.append('isLent', filters.isLent)
            if (filters.category) params.append('category', filters.category)
            if (filters.minRating) params.append('minRating', filters.minRating)
            if (filters.tags) params.append('tags', filters.tags)

            const res = await fetch(`/api/books?${params.toString()}`)
            if (!res.ok) throw new Error('Failed to fetch books')
            const data = await res.json()
            setBooks(data)
        } catch (error) {
            console.error('Failed to fetch books', error)
            setBooks([]) // Ensure books is always an array
        } finally {
            setLoading(false)
        }
    }

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }))
    }

    const clearFilters = () => {
        setFilters({
            libraryId: '',
            readStatus: '',
            isLent: '',
            category: '',
            minRating: '',
            tags: ''
        })
        setSearch('')
    }

    const activeFilterCount = Object.values(filters).filter(Boolean).length

    return (
        <div className="space-y-6 pb-20">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Library</h1>
                    <p className="text-muted-foreground">Manage your collection</p>
                </div>
                <div className="flex gap-2 bg-secondary p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <LayoutGrid size={20} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <ListIcon size={20} />
                    </button>
                </div>
            </header>

            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <input
                        type="text"
                        placeholder="Search title, author, ISBN..."
                        className="input-field pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setShowFilters(true)}
                    className={`p-3 rounded-lg border transition-colors flex items-center gap-2 ${activeFilterCount > 0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-secondary'}`}
                >
                    <Filter size={20} />
                    {activeFilterCount > 0 && <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>}
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="aspect-[2/3] bg-muted animate-pulse rounded-xl" />
                    ))}
                </div>
            ) : books.length === 0 ? (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <BookOpen size={32} className="text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">No books found</h3>
                    <p className="text-muted-foreground mt-1">Try adjusting your search or filters.</p>
                    {(search || activeFilterCount > 0) && (
                        <button onClick={clearFilters} className="mt-4 text-primary hover:underline">
                            Clear all filters
                        </button>
                    )}
                </div>
            ) : (
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-4'}>
                    {books.map((book) => (
                        <BookCard key={book.id} book={book} viewMode={viewMode} />
                    ))}
                </div>
            )}

            {/* Filter Modal */}
            {showFilters && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-900 w-full md:w-[400px] md:rounded-xl rounded-t-xl shadow-xl animate-in slide-in-from-bottom-10 duration-300 flex flex-col max-h-[90vh] border border-border">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Filters</h2>
                            <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-secondary rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto">
                            {/* Library Filter */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Library</label>
                                <select
                                    className="input-field bg-secondary border-transparent focus:bg-background focus:border-ring"
                                    value={filters.libraryId}
                                    onChange={(e) => handleFilterChange('libraryId', e.target.value)}
                                >
                                    <option value="">All Libraries</option>
                                    {libraries.map(lib => (
                                        <option key={lib.id} value={lib.id}>{lib.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Filter */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Reading Status</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['WANT_TO_READ', 'READING', 'READ'].map(status => (
                                        <button
                                            key={status}
                                            onClick={() => handleFilterChange('readStatus', filters.readStatus === status ? '' : status)}
                                            className={`px-2 py-2 text-xs font-medium rounded-lg border transition-all ${filters.readStatus === status ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-transparent hover:bg-secondary/80 text-foreground'}`}
                                        >
                                            {status.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Lending Status */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Availability</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleFilterChange('isLent', filters.isLent === 'false' ? '' : 'false')}
                                        className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${filters.isLent === 'false' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-transparent hover:bg-secondary/80 text-foreground'}`}
                                    >
                                        Available
                                    </button>
                                    <button
                                        onClick={() => handleFilterChange('isLent', filters.isLent === 'true' ? '' : 'true')}
                                        className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${filters.isLent === 'true' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-transparent hover:bg-secondary/80 text-foreground'}`}
                                    >
                                        Lent Out
                                    </button>
                                </div>
                            </div>

                            {/* Rating Filter */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Minimum Rating</label>
                                <div className="flex gap-2 p-3 rounded-lg bg-secondary border border-transparent">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => handleFilterChange('minRating', filters.minRating === star.toString() ? '' : star.toString())}
                                            className="focus:outline-none transition-transform hover:scale-110"
                                        >
                                            <Star
                                                size={32}
                                                className={`${parseInt(filters.minRating || '0') >= star
                                                    ? 'fill-yellow-400 text-yellow-400'
                                                    : 'text-muted-foreground/30'
                                                    } transition-colors`}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {filters.minRating ? `${filters.minRating} stars or more` : 'Any rating'}
                                </p>
                            </div>

                            {/* Tags Filter */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Tags</label>
                                <div className="flex flex-wrap gap-2">
                                    {availableTags.map(tag => {
                                        const isSelected = filters.tags.split(',').includes(tag.name)
                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => {
                                                    const currentTags = filters.tags ? filters.tags.split(',') : []
                                                    let newTags
                                                    if (isSelected) {
                                                        newTags = currentTags.filter(t => t !== tag.name)
                                                    } else {
                                                        newTags = [...currentTags, tag.name]
                                                    }
                                                    handleFilterChange('tags', newTags.join(','))
                                                }}
                                                className={`px-2 py-1 text-xs rounded-md border transition-all ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-transparent hover:bg-secondary/80 text-foreground'}`}
                                            >
                                                {tag.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-border flex gap-3">
                            <button
                                onClick={clearFilters}
                                className="flex-1 py-2.5 rounded-lg border border-transparent bg-secondary font-medium hover:bg-secondary/80 transition-colors"
                            >
                                Clear All
                            </button>
                            <button
                                onClick={() => setShowFilters(false)}
                                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                            >
                                Show Results
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
