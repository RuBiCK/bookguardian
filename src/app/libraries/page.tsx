'use client'

import { useState, useEffect } from 'react'
import { Plus, Library as LibraryIcon, MapPin, ChevronRight, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Library {
    id: string
    name: string
    location: string
    shelves: { id: string, _count: { books: number } }[]
}

export default function LibrariesPage() {
    const [libraries, setLibraries] = useState<Library[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [newLibName, setNewLibName] = useState('')
    const [newLibLocation, setNewLibLocation] = useState('')

    useEffect(() => {
        fetchLibraries()
    }, [])

    const fetchLibraries = async () => {
        try {
            const res = await fetch('/api/libraries')
            const data = await res.json()
            setLibraries(data)
        } catch (error) {
            console.error('Error fetching libraries:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddLibrary = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch('/api/libraries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newLibName, location: newLibLocation })
            })
            if (res.ok) {
                setShowAddModal(false)
                setNewLibName('')
                setNewLibLocation('')
                fetchLibraries()
            }
        } catch (error) {
            console.error('Error creating library:', error)
        }
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="pb-20">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">My Libraries</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary flex items-center gap-2 px-4 py-2"
                >
                    <Plus size={20} />
                    New Library
                </button>
            </div>

            <div className="grid gap-4">
                {libraries.map(lib => (
                    <Link href={`/libraries/${lib.id}`} key={lib.id} className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-secondary rounded-lg text-primary">
                                <LibraryIcon size={24} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">{lib.name}</h3>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                    <MapPin size={14} />
                                    {lib.location || 'No location'}
                                </div>
                                <div className="text-xs text-muted-foreground mt-2">
                                    {lib.shelves.length} Shelves • {lib.shelves.reduce((acc, s) => acc + s._count.books, 0)} Books
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                ))}
            </div>

            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-background rounded-xl p-6 w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-bold mb-4">Add New Library</h2>
                        <form onSubmit={handleAddLibrary} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    required
                                    value={newLibName}
                                    onChange={e => setNewLibName(e.target.value)}
                                    placeholder="e.g. Home Office"
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Location</label>
                                <input
                                    value={newLibLocation}
                                    onChange={e => setNewLibLocation(e.target.value)}
                                    placeholder="e.g. 2nd Floor"
                                    className="input-field"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary px-4 py-2">
                                    Create Library
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
