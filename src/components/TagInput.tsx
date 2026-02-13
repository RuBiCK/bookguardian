'use client'

import { useState, useRef, useCallback } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
    value: string[]
    onChange: (tags: string[]) => void
    suggestions?: { name: string; count: number }[]
    placeholder?: string
}

const MAX_TAGS = 20
const MAX_TAG_LENGTH = 50

export default function TagInput({ value, onChange, suggestions = [], placeholder = 'Add a tag...' }: TagInputProps) {
    const [inputValue, setInputValue] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const addTag = useCallback((tag: string) => {
        const trimmed = tag.trim().toLowerCase()
        if (!trimmed) return
        if (trimmed.length > MAX_TAG_LENGTH) return
        if (value.length >= MAX_TAGS) return
        if (value.some(t => t.toLowerCase() === trimmed)) return
        onChange([...value, trimmed])
        setInputValue('')
    }, [value, onChange])

    const removeTag = useCallback((index: number) => {
        onChange(value.filter((_, i) => i !== index))
    }, [value, onChange])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addTag(inputValue)
        } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
            removeTag(value.length - 1)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        if (val.includes(',')) {
            const parts = val.split(',')
            parts.forEach((part, i) => {
                if (i < parts.length - 1) {
                    addTag(part)
                } else {
                    setInputValue(part)
                }
            })
        } else {
            setInputValue(val)
        }
    }

    const filteredSuggestions = suggestions.filter(
        s => !value.some(t => t.toLowerCase() === s.name.toLowerCase())
    )

    return (
        <div className="space-y-2">
            <div
                className="input-field flex flex-wrap gap-1.5 cursor-text min-h-[42px] py-2"
                onClick={() => inputRef.current?.focus()}
            >
                {value.map((tag, index) => (
                    <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-sm"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                removeTag(index)
                            }}
                            className="hover:text-primary/70 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={value.length === 0 ? placeholder : ''}
                    className="flex-1 min-w-[80px] outline-none bg-transparent text-sm"
                    disabled={value.length >= MAX_TAGS}
                />
            </div>
            {filteredSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground self-center">Suggestions:</span>
                    {filteredSuggestions.map(s => (
                        <button
                            key={s.name}
                            type="button"
                            onClick={() => addTag(s.name)}
                            className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border text-xs hover:bg-secondary/80 transition-colors"
                            disabled={value.length >= MAX_TAGS}
                        >
                            {s.name} <span className="text-muted-foreground">({s.count})</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
