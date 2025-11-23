'use client'

import { useState, useEffect, use } from 'react'
import { Plus, ArrowLeft, Trash2, Book, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Shelf {
    id: string
    name: string
    _count: { books: number }
}

interface Library {
    id: string
    name: string
    location: string
    shelves: Shelf[]
}

export default function LibraryDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [library, setLibrary] = useState<Library | null>(null)
    const [loading, setLoading] = useState(true)
    const [showAddShelf, setShowAddShelf] = useState(false)
    const [newShelfName, setNewShelfName] = useState('')

    useEffect(() => {
        fetchLibrary()
    }, [id])

    const fetchLibrary = async () => {
        try {
            const res = await fetch(`/api/libraries/${id}`)
            if (res.ok) {
                const data = await res.json()
                setLibrary(data)
            }
        } catch (error) {
            console.error('Error fetching library:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddShelf = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch('/api/shelves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newShelfName, libraryId: id })
            })
            if (res.ok) {
                setShowAddShelf(false)
                setNewShelfName('')
                fetchLibrary()
            }
        } catch (error) {
            console.error('Error creating shelf:', error)
        }
    }

    const handleDeleteLibrary = async () => {
        if (!confirm('Are you sure you want to delete this library? All shelves and books will be deleted.')) return

        try {
            const res = await fetch(`/api/libraries/${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                router.push('/libraries')
            }
        } catch (error) {
            console.error('Error deleting library:', error)
        }
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
    if (!library) return <div className="p-8 text-center">Library not found</div>

    return (
        <div className="pb-20">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/libraries" className="p-2 hover:bg-secondary rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{library.name}</h1>
                    <p className="text-muted-foreground text-sm">{library.location}</p>
                </div>
                <button
                    onClick={handleDeleteLibrary}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                >
                    <Trash2 size={20} />
                </button>
            </div>

            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Shelves</h2>
                <button
                    onClick={() => setShowAddShelf(true)}
                    className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
                >
                    <Plus size={16} />
                    Add Shelf
                </button>
            </div>

            <div className="grid gap-3">
                {library.shelves.map(shelf => (
                    <div key={shelf.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-secondary rounded-md">
                                <Book size={20} className="text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="font-medium">{shelf.name}</h3>
                                <p className="text-xs text-muted-foreground">{shelf._count.books} books</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showAddShelf && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-background rounded-xl p-6 w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-bold mb-4">Add New Shelf</h2>
                        <form onSubmit={handleAddShelf} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    required
                                    value={newShelfName}
                                    onChange={e => setNewShelfName(e.target.value)}
                                    placeholder="e.g. Top Shelf"
                                    className="input-field"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddShelf(false)}
                                    className="px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary px-4 py-2">
                                    Create Shelf
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
