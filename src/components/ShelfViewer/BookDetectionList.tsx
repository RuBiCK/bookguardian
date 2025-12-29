'use client'

import { EnrichedDetectedBook } from '@/lib/ai/types'
import BookSelectionItem from './BookSelectionItem'
import { CheckSquare, Square } from 'lucide-react'

interface BookDetectionListProps {
  books: EnrichedDetectedBook[]
  selectedIndices: Set<number>
  onToggleSelection: (index: number) => void
  onSelectAll: () => void
  onUnselectAll: () => void
  onAddSingle?: (index: number) => void
  onAddWithSearch?: (index: number, bookData: any) => void
  onEditBeforeSave?: (index: number) => void
  addingSingleIndex?: number
}

export default function BookDetectionList({
  books,
  selectedIndices,
  onToggleSelection,
  onSelectAll,
  onUnselectAll,
  onAddSingle,
  onAddWithSearch,
  onEditBeforeSave,
  addingSingleIndex,
}: BookDetectionListProps) {
  // Filter out unreadable books
  const readableBooks = books.map((book, originalIndex) => ({ book, originalIndex }))
    .filter(({ book }) => book.readabilityStatus !== 'unreadable')

  return (
    <div className="space-y-3">
      {/* Header with selection controls */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">Detected Books</h3>
          <span className="text-xs px-2 py-0.5 bg-secondary/70 text-muted-foreground rounded-full font-medium">
            {selectedIndices.size} of {readableBooks.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onSelectAll}
            className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors flex items-center gap-1 font-medium"
          >
            <CheckSquare size={13} />
            All
          </button>
          <button
            onClick={onUnselectAll}
            className="text-xs px-2.5 py-1 bg-secondary/70 text-foreground rounded hover:bg-secondary transition-colors flex items-center gap-1 font-medium"
          >
            <Square size={13} />
            None
          </button>
        </div>
      </div>

      {/* Scrollable book list */}
      <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
        {readableBooks.map(({ book, originalIndex }) => (
          <BookSelectionItem
            key={originalIndex}
            book={book}
            index={originalIndex}
            isSelected={selectedIndices.has(originalIndex)}
            onToggle={() => onToggleSelection(originalIndex)}
            onAddSingle={onAddSingle ? () => onAddSingle(originalIndex) : undefined}
            onAddWithSearch={onAddWithSearch ? (bookData) => onAddWithSearch(originalIndex, bookData) : undefined}
            onEditBeforeSave={onEditBeforeSave ? () => onEditBeforeSave(originalIndex) : undefined}
            isAddingSingle={addingSingleIndex === originalIndex}
          />
        ))}
      </div>
    </div>
  )
}
