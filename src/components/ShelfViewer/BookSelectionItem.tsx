'use client'

import { useState, useRef } from 'react'
import { EnrichedDetectedBook } from '@/lib/ai/types'
import { CheckCircle, Circle, Book, Plus, Sparkles, BookText, User, Calendar } from 'lucide-react'
import ReadabilityPopover from '../ReadabilityPopover'
import BookSearchModal from '../BookSearchModal'

interface BookSelectionItemProps {
  book: EnrichedDetectedBook
  index: number
  isSelected: boolean
  onToggle: () => void
  onAddSingle?: () => void
  onAddWithSearch?: (bookData: any) => void
  onEditBeforeSave?: () => void
  isAddingSingle?: boolean
}

export default function BookSelectionItem({
  book,
  index,
  isSelected,
  onToggle,
  onAddSingle,
  onAddWithSearch,
  onEditBeforeSave,
  isAddingSingle,
}: BookSelectionItemProps) {
  const disabled = book.inCollection
  const [showPopover, setShowPopover] = useState(false)
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const badgeRef = useRef<HTMLButtonElement>(null)

  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (badgeRef.current) {
      setPopoverRect(badgeRef.current.getBoundingClientRect())
      setShowPopover(true)
    }
  }

  const handleSearchClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowSearchModal(true)
  }

  const handleSearchSelect = (bookData: any) => {
    setShowSearchModal(false)
    if (onAddWithSearch) {
      onAddWithSearch(bookData)
    }
  }

  return (
    <>
    <div
      className={`w-full flex gap-3 p-3 bg-card border rounded-lg transition-all ${
        disabled ? 'opacity-50' : ''
      } ${isSelected && !disabled ? 'border-primary bg-primary/5' : 'border-border hover:border-border/60'}`}
    >
      {/* Checkbox */}
      <button
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className="flex-shrink-0 hover:opacity-70 transition-opacity disabled:cursor-not-allowed"
      >
        {disabled ? (
          <CheckCircle className="text-green-500" size={20} />
        ) : isSelected ? (
          <CheckCircle className="text-primary" size={20} />
        ) : (
          <Circle className="text-muted-foreground" size={20} />
        )}
      </button>

      {/* Cover */}
      <div className="flex-shrink-0">
        {book.googleBooksData?.coverUrl ? (
          <img
            src={book.googleBooksData.coverUrl}
            alt={book.title}
            className="w-10 h-14 object-cover rounded shadow-sm"
          />
        ) : (
          <div className="w-10 h-14 bg-secondary/50 rounded flex items-center justify-center">
            <Book size={16} className="text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* Title and position */}
        <div className="flex items-start gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <BookText size={14} className="text-muted-foreground/60 flex-shrink-0" />
            <h4 className="font-medium text-sm line-clamp-1">{book.title}</h4>
          </div>
          <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 font-mono mt-0.5">#{index + 1}</span>
        </div>

        {/* Author */}
        {book.author && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <User size={12} className="text-muted-foreground/60 flex-shrink-0" />
            <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
          </div>
        )}

        {/* Metadata row - compact inline badges */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {book.inCollection && (
            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-700 dark:text-green-400 rounded font-medium">
              In Library
            </span>
          )}

          {book.readabilityStatus && book.readabilityStatus !== 'clear' && (
            <button
              ref={badgeRef}
              onClick={handleBadgeClick}
              className={`px-1.5 py-0.5 rounded font-medium cursor-pointer hover:opacity-80 transition-opacity ${
                book.readabilityStatus === 'partial'
                  ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                  : book.readabilityStatus === 'uncertain'
                  ? 'bg-orange-500/20 text-orange-700 dark:text-orange-400'
                  : 'bg-red-500/20 text-red-700 dark:text-red-400'
              }`}
            >
              {book.readabilityStatus === 'partial' && '⚠ Partial'}
              {book.readabilityStatus === 'uncertain' && '❓ Uncertain'}
              {book.readabilityStatus === 'unreadable' && '❌ Unreadable'}
            </button>
          )}

          {!book.inCollection && book.confidence !== undefined && (
            <span className={`px-1.5 py-0.5 rounded font-medium ${
              book.confidence >= 0.7
                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
            }`}>
              {(book.confidence * 100).toFixed(0)}%
            </span>
          )}

          {book.googleBooksData?.year && (
            <span className="px-1.5 py-0.5 bg-secondary/70 text-muted-foreground rounded flex items-center gap-1">
              <Calendar size={10} className="flex-shrink-0" />
              {book.googleBooksData.year}
            </span>
          )}

          {book.isbn && (
            <span className="px-1.5 py-0.5 bg-secondary/70 text-muted-foreground rounded font-mono">
              {book.isbn.length > 10 ? `${book.isbn.slice(0, 10)}...` : book.isbn}
            </span>
          )}
        </div>
      </div>

      {/* Action Icons - more compact */}
      {!disabled && (onAddSingle || onAddWithSearch || onEditBeforeSave) && (
        <div className="flex-shrink-0 self-center flex items-center gap-1.5">
          {/* AI Magic Icon - Search or Edit */}
          {(onAddWithSearch || onEditBeforeSave) && (
            <button
              onClick={onEditBeforeSave ? onEditBeforeSave : handleSearchClick}
              disabled={isAddingSingle}
              className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={onEditBeforeSave ? "Edit before adding to library" : "Search for this book"}
            >
              <Sparkles size={16} />
            </button>
          )}

          {/* Add Button */}
          {onAddSingle && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAddSingle()
              }}
              disabled={isAddingSingle}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-xs font-medium"
              title="Add to library"
            >
              {isAddingSingle ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Adding</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Add</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>

    {/* Readability Popover */}
    {showPopover && popoverRect && book.readabilityStatus && (
      <ReadabilityPopover
        status={book.readabilityStatus}
        onClose={() => setShowPopover(false)}
        anchorRect={popoverRect}
      />
    )}

    {/* Search Modal */}
    {showSearchModal && (
      <BookSearchModal
        initialQuery={`${book.title}${book.author ? ' ' + book.author : ''}`}
        onSelect={handleSearchSelect}
        onClose={() => setShowSearchModal(false)}
      />
    )}
    </>
  )
}
