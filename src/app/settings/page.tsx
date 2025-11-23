'use client'

import { useState, useEffect } from 'react'
import { BarChart3, BookOpen, PieChart, Loader2, Download } from 'lucide-react'

interface Stats {
    totalBooks: number
    readStatusCounts: { status: string, count: number }[]
    categoryCounts: { category: string, count: number }[]
}

interface ExportBook {
    id: string
    title: string
    author: string
    isbn: string
    publisher: string
    year: string | number
    language: string
    category: string
    rating: number
    readStatus: string
    comment: string
    shelf: string
    library: string
    libraryLocation: string
    tags: string
    coverUrl: string
    lentTo: string
    createdAt: string
    updatedAt: string
}

export default function SettingsPage() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/stats')
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            }
        } catch (error) {
            console.error('Error fetching stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'WANT_TO_READ': return 'Want to Read'
            case 'READING': return 'Reading'
            case 'READ': return 'Read'
            default: return status
        }
    }

    const [exporting, setExporting] = useState(false)

    // CSV Export Function
    const exportToCSV = async () => {
        setExporting(true)
        try {
            const res = await fetch('/api/export')
            if (!res.ok) throw new Error('Failed to fetch export data')
            const books: ExportBook[] = await res.json()

            // CSV Headers
            const headers = [
                'Title', 'Author', 'ISBN', 'Publisher', 'Year', 'Language',
                'Category', 'Rating', 'Read Status', 'Shelf', 'Library',
                'Library Location', 'Tags', 'Comment', 'Lent To'
            ]

            // Escape CSV field
            const escapeCSV = (field: string | number) => {
                const str = String(field)
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`
                }
                return str
            }

            // Build CSV content
            const csvRows = [headers.join(',')]
            books.forEach(book => {
                const row = [
                    escapeCSV(book.title),
                    escapeCSV(book.author),
                    escapeCSV(book.isbn),
                    escapeCSV(book.publisher),
                    escapeCSV(book.year),
                    escapeCSV(book.language),
                    escapeCSV(book.category),
                    escapeCSV(book.rating),
                    escapeCSV(getStatusLabel(book.readStatus)),
                    escapeCSV(book.shelf),
                    escapeCSV(book.library),
                    escapeCSV(book.libraryLocation),
                    escapeCSV(book.tags),
                    escapeCSV(book.comment),
                    escapeCSV(book.lentTo)
                ]
                csvRows.push(row.join(','))
            })

            const csvContent = csvRows.join('\n')
            downloadFile(csvContent, `library-export-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
        } catch (error) {
            console.error('Error exporting to CSV:', error)
            alert('Failed to export to CSV')
        } finally {
            setExporting(false)
        }
    }

    // MARC21 Export Function
    const exportToMARC21 = async () => {
        setExporting(true)
        try {
            const res = await fetch('/api/export')
            if (!res.ok) throw new Error('Failed to fetch export data')
            const books: ExportBook[] = await res.json()

            // Build MARC21 records
            const marcRecords: string[] = []

            books.forEach(book => {
                const fields: string[] = []

                // Leader (24 characters) - simplified
                fields.push('=LDR  00000nam  2200000   4500')

                // 020 - ISBN
                if (book.isbn) {
                    fields.push(`=020  \\\\$a${book.isbn}`)
                }

                // 100 - Main Entry - Personal Name (Author)
                if (book.author) {
                    fields.push(`=100  1\\$a${book.author}`)
                }

                // 245 - Title Statement
                fields.push(`=245  10$a${book.title}`)

                // 260 - Publication, Distribution, etc.
                if (book.publisher || book.year) {
                    let field260 = '=260  \\\\$a'
                    if (book.publisher) field260 += `$b${book.publisher}`
                    if (book.year) field260 += `$c${book.year}`
                    fields.push(field260)
                }

                // 041 - Language Code
                if (book.language) {
                    fields.push(`=041  \\\\$a${book.language.toLowerCase().substring(0, 3)}`)
                }

                // 650 - Subject Added Entry - Topical Term (Category)
                if (book.category) {
                    fields.push(`=650  \\4$a${book.category}`)
                }

                // 653 - Index Term - Uncontrolled (Tags)
                if (book.tags) {
                    book.tags.split('; ').forEach(tag => {
                        if (tag) fields.push(`=653  \\\\$a${tag}`)
                    })
                }

                // 856 - Electronic Location and Access (Cover URL)
                if (book.coverUrl) {
                    fields.push(`=856  40$u${book.coverUrl}`)
                }

                // 500 - General Note (Comment)
                if (book.comment) {
                    fields.push(`=500  \\\\$a${book.comment}`)
                }

                // 852 - Location (Library and Shelf)
                fields.push(`=852  \\\\$a${book.library}$b${book.shelf}`)

                // 949 - Local Processing Information (Custom fields)
                fields.push(`=949  \\\\$aRead Status: ${getStatusLabel(book.readStatus)}`)
                if (book.rating > 0) {
                    fields.push(`=949  \\\\$aRating: ${book.rating}/5`)
                }
                if (book.lentTo) {
                    fields.push(`=949  \\\\$aLent to: ${book.lentTo}`)
                }

                marcRecords.push(fields.join('\n'))
            })

            const marcContent = marcRecords.join('\n\n')
            downloadFile(marcContent, `library-export-${new Date().toISOString().split('T')[0]}.mrc`, 'text/plain')
        } catch (error) {
            console.error('Error exporting to MARC21:', error)
            alert('Failed to export to MARC21')
        } finally {
            setExporting(false)
        }
    }

    // JSON Export Function
    const exportToJSON = async () => {
        setExporting(true)
        try {
            const res = await fetch('/api/export')
            if (!res.ok) throw new Error('Failed to fetch export data')
            const books: ExportBook[] = await res.json()

            const jsonContent = JSON.stringify(books, null, 2)
            downloadFile(jsonContent, `library-export-${new Date().toISOString().split('T')[0]}.json`, 'application/json')
        } catch (error) {
            console.error('Error exporting to JSON:', error)
            alert('Failed to export to JSON')
        } finally {
            setExporting(false)
        }
    }

    // Helper function to trigger download
    const downloadFile = (content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="pb-20">
            <h1 className="text-2xl font-bold mb-6">Settings & Statistics</h1>

            <div className="grid gap-6">
                {/* Overview Card */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-lg">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Total Books</h2>
                            <p className="text-3xl font-bold">{stats?.totalBooks || 0}</p>
                        </div>
                    </div>
                </div>

                {/* Reading Status */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <PieChart size={20} className="text-muted-foreground" />
                        <h2 className="text-lg font-semibold">Reading Status</h2>
                    </div>
                    <div className="space-y-3">
                        {stats?.readStatusCounts.map((item) => (
                            <div key={item.status} className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">{getStatusLabel(item.status)}</span>
                                <div className="flex items-center gap-3">
                                    <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full"
                                            style={{ width: `${(item.count / (stats?.totalBooks || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium w-6 text-right">{item.count}</span>
                                </div>
                            </div>
                        ))}
                        {stats?.readStatusCounts.length === 0 && <p className="text-sm text-muted-foreground">No books added yet.</p>}
                    </div>
                </div>

                {/* Top Categories */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <BarChart3 size={20} className="text-muted-foreground" />
                        <h2 className="text-lg font-semibold">Top Categories</h2>
                    </div>
                    <div className="space-y-3">
                        {stats?.categoryCounts.map((item) => (
                            <div key={item.category} className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground truncate max-w-[150px]">{item.category}</span>
                                <div className="flex items-center gap-3">
                                    <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full"
                                            style={{ width: `${(item.count / (stats?.totalBooks || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium w-6 text-right">{item.count}</span>
                                </div>
                            </div>
                        ))}
                        {stats?.categoryCounts.length === 0 && <p className="text-sm text-muted-foreground">No categories found.</p>}
                    </div>
                </div>

                {/* Export Library */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <Download size={20} className="text-muted-foreground" />
                        <h2 className="text-lg font-semibold">Export Library</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                        Export your entire book collection in industry-standard formats
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                            onClick={exportToCSV}
                            disabled={exporting}
                            className="flex flex-col items-center gap-2 p-4 bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-border"
                        >
                            <Download size={20} />
                            <div className="text-center">
                                <div className="font-medium text-sm">CSV</div>
                                <div className="text-xs text-muted-foreground">Spreadsheet format</div>
                            </div>
                        </button>
                        <button
                            onClick={exportToMARC21}
                            disabled={exporting}
                            className="flex flex-col items-center gap-2 p-4 bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-border"
                        >
                            <Download size={20} />
                            <div className="text-center">
                                <div className="font-medium text-sm">MARC21</div>
                                <div className="text-xs text-muted-foreground">Library standard</div>
                            </div>
                        </button>
                        <button
                            onClick={exportToJSON}
                            disabled={exporting}
                            className="flex flex-col items-center gap-2 p-4 bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-border"
                        >
                            <Download size={20} />
                            <div className="text-center">
                                <div className="font-medium text-sm">JSON</div>
                                <div className="text-xs text-muted-foreground">Data backup</div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Other Settings Placeholder */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm opacity-50">
                    <h2 className="text-lg font-semibold mb-2">App Preferences</h2>
                    <p className="text-sm text-muted-foreground">Theme and notification settings coming soon.</p>
                </div>
            </div>
        </div>
    )
}
