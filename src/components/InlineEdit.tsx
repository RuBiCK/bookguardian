'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, X } from 'lucide-react'

interface InlineEditProps {
  value: string
  onSave: (newValue: string) => void | Promise<void>
  className?: string
  placeholder?: string
  multiline?: boolean
  disabled?: boolean
  singleClick?: boolean
}

export default function InlineEdit({
  value,
  onSave,
  className = '',
  placeholder = 'Enter value...',
  multiline = false,
  disabled = false,
  singleClick = false,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const handleDoubleClick = () => {
    if (disabled) return
    setIsEditing(true)
  }

  const handleSingleClick = () => {
    if (disabled) return
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (editValue.trim() === '') {
      handleCancel()
      return
    }

    if (editValue !== value) {
      setIsSaving(true)
      try {
        await onSave(editValue.trim())
      } catch (error) {
        console.error('Failed to save:', error)
        setEditValue(value)
      } finally {
        setIsSaving(false)
      }
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Enter' && multiline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleBlur = () => {
    handleSave()
  }

  if (isEditing) {
    return (
      <span className="relative inline-flex items-center gap-1">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={isSaving}
            className={`${className} resize-none w-full`}
            rows={3}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={isSaving}
            className={`${className} min-w-[100px]`}
          />
        )}
        <span className="absolute -right-16 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
          <span className="px-1 py-0.5 bg-secondary rounded">Enter</span>
          <span className="px-1 py-0.5 bg-secondary rounded">Esc</span>
        </span>
      </span>
    )
  }

  return (
    <span
      onDoubleClick={singleClick ? undefined : handleDoubleClick}
      onClick={singleClick ? handleSingleClick : undefined}
      className={`${className} ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-text hover:bg-secondary/30 rounded px-1 -mx-1 transition-colors inline-block'
      }`}
      title={disabled ? '' : (singleClick ? 'Click to edit' : 'Double-click to edit')}
    >
      {value || <span className="text-muted-foreground italic">{placeholder}</span>}
    </span>
  )
}
