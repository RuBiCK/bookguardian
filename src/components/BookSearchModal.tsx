'use client'

import { useState } from 'react'
import { X, Search, Loader2, Book } from 'lucide-react'

interface BookSearchResult {
  title: string
  author?: string
  isbn?: string
  coverUrl?: string
  publisher?: string
  year?: number
  category?: string
}

interface BookSearchModalProps {
  initialQuery: string
  onSelect: (book: BookSearchResult) => void
  onClose: () => void
}

export default function BookSearchModal({ initialQuery, onSelect, onClose }: BookSearchModalProps) {
  const [query, setQuery] = useState(initialQuery)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) return

    setSearching(true)
    setError(null)

    try {
      const response = await fetch('/api/books/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Search failed')
      }

      if (data.results && data.results.length > 0) {
        setResults(data.results)
      } else {
        setError('No books found. Try a different search term.')
      }
    } catch (err) {
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : 'Failed to search')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border border-border rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Search for Book</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter book title, author, or ISBN..."
              className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="text-center py-8 text-red-500">
              <p>{error}</p>
            </div>
          )}

          {!searching && !error && results.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search size={48} className="mx-auto mb-4 opacity-30" />
              <p>Enter a search term to find books</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Found {results.length} result{results.length > 1 ? 's' : ''}. Click on a book to add it.
              </p>
              {results.map((book, index) => (
                <button
                  key={index}
                  onClick={() => onSelect(book)}
                  className="w-full flex gap-4 p-4 bg-card border border-border rounded-xl text-left hover:bg-secondary/50 transition-colors"
                >
                  {/* Cover */}
                  <div className="flex-shrink-0">
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="w-16 h-24 object-cover rounded shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-24 bg-secondary rounded flex items-center justify-center">
                        <Book size={24} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base line-clamp-2 mb-1">
                      {book.title}
                    </h3>

                    {book.author && (
                      <p className="text-sm text-muted-foreground mb-2">
                        by {book.author}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {book.isbn && (
                        <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded font-mono">
                          ISBN: {book.isbn}
                        </span>
                      )}

                      {book.year && (
                        <span className="text-xs px-2 py-1 bg-secondary rounded">
                          {book.year}
                        </span>
                      )}

                      {book.publisher && (
                        <span className="text-xs px-2 py-1 bg-secondary rounded">
                          {book.publisher}
                        </span>
                      )}

                      {book.category && (
                        <span className="text-xs px-2 py-1 bg-secondary rounded">
                          {book.category}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
