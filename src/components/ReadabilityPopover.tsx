'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { ReadabilityStatus } from '@/lib/ai/types'

interface ReadabilityPopoverProps {
  status: ReadabilityStatus
  onClose: () => void
  anchorRect: DOMRect
}

const explanations = {
  partial: {
    title: '⚠ Partial',
    description: 'Could only read part of the title (blurry, bad angle, or partially visible)',
    color: 'yellow',
  },
  uncertain: {
    title: '❓ Uncertain',
    description: 'Guessing, not 100% certain about the title',
    color: 'orange',
  },
  unreadable: {
    title: '❌ Unreadable',
    description: 'Cannot read the title clearly',
    color: 'red',
  },
  clear: {
    title: '✓ Clear',
    description: 'Title is clearly readable',
    color: 'green',
  },
}

export default function ReadabilityPopover({ status, onClose, anchorRect }: ReadabilityPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const explanation = explanations[status]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const colorClasses = {
    yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800',
    orange: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800',
    red: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
    green: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
  }

  // Position the popover near the badge
  const style = {
    position: 'fixed' as const,
    top: `${anchorRect.bottom + 8}px`,
    left: `${anchorRect.left}px`,
    zIndex: 10000,
  }

  return (
    <div
      ref={popoverRef}
      style={style}
      className={`min-w-[280px] max-w-sm rounded-lg border shadow-lg p-4 animate-in fade-in zoom-in-95 ${colorClasses[explanation.color as keyof typeof colorClasses]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-1">{explanation.title}</h4>
          <p className="text-xs text-muted-foreground">{explanation.description}</p>
          <p className="text-xs text-muted-foreground mt-2 italic">
            💡 Tip: For better results, ensure good lighting and capture the shelf straight-on.
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
