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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-8 w-full max-w-lg shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        <h2 className="text-2xl font-bold mb-6 text-neutral-900 dark:text-white">Add New Library</h2>
                        <form onSubmit={handleAddLibrary} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-neutral-700 dark:text-neutral-300">
                                    Name
                                </label>
                                <input
                                    required
                                    value={newLibName}
                                    onChange={e => setNewLibName(e.target.value)}
                                    placeholder="e.g. Home Office"
                                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-neutral-700 dark:text-neutral-300">
                                    Location
                                </label>
                                <input
                                    value={newLibLocation}
                                    onChange={e => setNewLibLocation(e.target.value)}
                                    placeholder="e.g. 2nd Floor"
                                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-6 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors font-medium text-neutral-700 dark:text-neutral-300"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl font-semibold">
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
