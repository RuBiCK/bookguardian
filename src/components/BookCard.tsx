import Image from 'next/image'
import { Book, Tag, Lending } from '@prisma/client'
import { Star, BookOpen, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { separateTags, formatSourceName } from '@/lib/source-tags'

type BookWithTags = Book & {
    tags: Tag[]
    lendings?: Lending[]
}

interface BookCardProps {
    book: BookWithTags
    viewMode: 'grid' | 'list'
}

// Helper to format read status
function formatReadStatus(status: string, compact: boolean = false): string {
    const formats: Record<string, { full: string; compact: string }> = {
        'WANT_TO_READ': { full: 'Want to Read', compact: 'To Read' },
        'READING': { full: 'Reading', compact: 'Reading' },
        'READ': { full: 'Read', compact: 'Read' },
    }
    return formats[status]?.[compact ? 'compact' : 'full'] || status
}

export default function BookCard({ book, viewMode }: BookCardProps) {
    const { sourceTags, userTags } = separateTags(book.tags || [])
    const hasAISource = sourceTags.some(t => !t.name.includes('manual'))
    const isLent = book.lendings?.some(lending => lending.status === 'LENT') || false

    if (viewMode === 'list') {
        return (
            <Link
                href={`/books/${book.id}`}
                className="group flex gap-3 p-3 bg-card border border-border rounded-xl hover:shadow-md hover:border-primary/30 transition-all duration-200"
            >
                {/* Cover */}
                <div className="relative w-16 h-24 shrink-0 overflow-hidden rounded-lg bg-amber-50 dark:bg-amber-900/10 shadow-sm">
                    {book.coverUrl ? (
                        <Image
                            src={book.coverUrl}
                            alt={book.title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-amber-700/40">
                            <BookOpen size={20} />
                        </div>
                    )}
                    {hasAISource && (
                        <div className="absolute top-0.5 right-0.5 p-0.5 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full shadow">
                            <Sparkles size={8} />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-semibold leading-tight line-clamp-1 group-hover:text-primary transition-colors">{book.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{book.author}</p>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                        {(book.rating || 0) > 0 && (
                            <div className="flex items-center gap-0.5 text-yellow-500 text-xs font-medium">
                                <Star size={11} fill="currentColor" />
                                <span>{book.rating}</span>
                            </div>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/80 text-secondary-foreground font-medium">
                            {formatReadStatus(book.readStatus)}
                        </span>
                        {isLent && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium border border-amber-500/30">
                                Lent
                            </span>
                        )}
                        {userTags.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                                {userTags.length} tag{userTags.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </div>
            </Link>
        )
    }

    // Grid view - diseño compacto y simétrico
    return (
        <Link
            href={`/books/${book.id}`}
            className="group flex flex-col h-[280px] bg-card border border-border rounded-lg hover:shadow-lg hover:border-primary/30 transition-all duration-200 overflow-hidden"
        >
            {/* Cover - altura fija */}
            <div className="relative w-full h-[160px] overflow-hidden bg-amber-50 dark:bg-amber-900/10 shrink-0">
                {book.coverUrl ? (
                    <Image
                        src={book.coverUrl}
                        alt={book.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-amber-700/40">
                        <BookOpen size={28} />
                    </div>
                )}
                {hasAISource && (
                    <div
                        className="absolute top-1 right-1 p-0.5 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full shadow-lg"
                        title={`AI: ${sourceTags.map(t => formatSourceName(t.name)).join(', ')}`}
                    >
                        <Sparkles size={9} />
                        {sourceTags.length > 1 && (
                            <span className="absolute -top-0.5 -right-0.5 bg-green-500 text-white text-[7px] rounded-full w-2.5 h-2.5 flex items-center justify-center font-bold shadow">
                                {sourceTags.length}
                            </span>
                        )}
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>

            {/* Content - altura fija */}
            <div className="p-2 flex flex-col flex-1 justify-between">
                {/* Título y autor */}
                <div>
                    <h3 className="text-[13px] font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {book.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{book.author}</p>
                </div>

                {/* Bottom info */}
                <div className="flex items-center justify-between gap-1.5 mt-1">
                    <div className="flex items-center gap-1 flex-wrap">
                        {(book.rating || 0) > 0 && (
                            <div className="flex items-center gap-0.5 text-yellow-500 text-[10px] font-medium">
                                <Star size={10} fill="currentColor" />
                                <span>{book.rating}</span>
                            </div>
                        )}
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/70 text-secondary-foreground font-medium">
                            {formatReadStatus(book.readStatus, true)}
                        </span>
                        {isLent && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium border border-amber-500/30">
                                Lent
                            </span>
                        )}
                    </div>

                    {userTags.length > 0 && (
                        <span className="text-[9px] text-muted-foreground font-medium shrink-0">
                            {userTags.length} tag{userTags.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    )
}
