import Image from 'next/image'
import { Book, Tag } from '@prisma/client'
import { Star, BookOpen } from 'lucide-react'
import Link from 'next/link'

type BookWithTags = Book & {
    tags: Tag[]
}

interface BookCardProps {
    book: BookWithTags
    viewMode: 'grid' | 'list'
}

export default function BookCard({ book, viewMode }: BookCardProps) {
    return (
        <Link href={`/books/${book.id}`} className={`group relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md ${viewMode === 'list' ? 'flex gap-4' : 'flex flex-col'}`}>
            <div className={`relative overflow-hidden bg-muted ${viewMode === 'list' ? 'w-24 h-36 shrink-0' : 'aspect-[2/3] w-full'}`}>
                {book.coverUrl ? (
                    <Image
                        src={book.coverUrl}
                        alt={book.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <BookOpen size={32} />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            <div className="flex flex-col justify-between p-4">
                <div>
                    <h3 className="font-semibold leading-tight line-clamp-2">{book.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{book.author}</p>
                </div>

                <div className="mt-4 flex items-center gap-2">
                    {(book.rating || 0) > 0 && (
                        <div className="flex items-center text-yellow-500 text-xs font-medium">
                            <Star size={14} fill="currentColor" />
                            <span className="ml-1">{book.rating}</span>
                        </div>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {book.readStatus.replace(/_/g, ' ')}
                    </span>
                </div>

                {/* Tags */}
                {book.tags && book.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                        {book.tags.slice(0, 3).map((tag: any) => (
                            <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                                {tag.name}
                            </span>
                        ))}
                        {book.tags.length > 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">+{book.tags.length - 3}</span>
                        )}
                    </div>
                )}
            </div>
        </Link>
    )
}
