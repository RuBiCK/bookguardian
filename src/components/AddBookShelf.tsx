'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, X, Loader2, CheckCircle, XCircle, BookOpen, Info } from 'lucide-react'
import { analyzeShelfImage, addMultipleBooksToShelf } from '@/app/actions/analyze-shelf'
import { ShelfAnalysisWithCollection, EnrichedDetectedBook } from '@/lib/ai/types'
import BookDetectionList from './ShelfViewer/BookDetectionList'
import Toast, { ToastType } from './Toast'
import { createSourceTag } from '@/lib/source-tags'
import AddBookManual from './AddBookManual'

const STORAGE_KEY_LIBRARY = 'bookForm_lastLibraryId'
const STORAGE_KEY_SHELF = 'bookForm_lastShelfId'

interface Library {
  id: string
  name: string
  shelves: { id: string; name: string }[]
}

interface AddBookShelfProps {
  onComplete?: () => void
  defaultShelfId?: string
}

export default function AddBookShelf({ onComplete, defaultShelfId }: AddBookShelfProps) {
  const [image, setImage] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<ShelfAnalysisWithCollection | null>(null)
  const [selectedBooks, setSelectedBooks] = useState<Set<number>>(new Set())
  const [adding, setAdding] = useState(false)
  const [addingSingleIndex, setAddingSingleIndex] = useState<number | undefined>(undefined)
  const [libraries, setLibraries] = useState<Library[]>([])
  const [selectedLibrary, setSelectedLibrary] = useState('')
  const [selectedShelf, setSelectedShelf] = useState('')
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [editingBook, setEditingBook] = useState<{ index: number; book: EnrichedDetectedBook } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ========================================================================
  // TOAST HELPER
  // ========================================================================

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type })
  }

  // ========================================================================
  // LIBRARY AND SHELF SELECTION
  // ========================================================================

  useEffect(() => {
    const fetchLibraries = async () => {
      try {
        const res = await fetch('/api/libraries')
        if (res.ok) {
          const data = await res.json()
          setLibraries(data)

          // Try to restore from localStorage or use defaultShelfId
          const savedLibraryId = localStorage.getItem(STORAGE_KEY_LIBRARY)
          const savedShelfId = localStorage.getItem(STORAGE_KEY_SHELF)

          if (defaultShelfId) {
            // If defaultShelfId provided, use it
            setSelectedShelf(defaultShelfId)
            const lib = data.find((lib: Library) =>
              lib.shelves?.find((s: { id: string }) => s.id === defaultShelfId)
            )
            if (lib) {
              setSelectedLibrary(lib.id)
            }
          } else if (savedLibraryId && data.find((lib: Library) => lib.id === savedLibraryId)) {
            setSelectedLibrary(savedLibraryId)
            const lib = data.find((lib: Library) => lib.id === savedLibraryId)
            if (savedShelfId && lib && lib.shelves?.find((s: { id: string; name: string }) => s.id === savedShelfId)) {
              setSelectedShelf(savedShelfId)
            } else if (lib && lib.shelves?.length > 0) {
              setSelectedShelf(lib.shelves[0].id)
            }
          } else {
            // Fallback to first library/shelf
            if (data.length > 0) {
              setSelectedLibrary(data[0].id)
              if (data[0].shelves?.length > 0) {
                setSelectedShelf(data[0].shelves[0].id)
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading libraries:', error)
      }
    }
    fetchLibraries()
  }, [defaultShelfId])

  // Save library selection to localStorage
  useEffect(() => {
    if (selectedLibrary) {
      localStorage.setItem(STORAGE_KEY_LIBRARY, selectedLibrary)
    }
  }, [selectedLibrary])

  // Save shelf selection to localStorage
  useEffect(() => {
    if (selectedShelf) {
      localStorage.setItem(STORAGE_KEY_SHELF, selectedShelf)
    }
  }, [selectedShelf])

  // Update shelf options when library changes
  const handleLibraryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const libId = e.target.value
    setSelectedLibrary(libId)
    const library = libraries.find(lib => lib.id === libId)
    if (library && library.shelves && library.shelves.length > 0) {
      setSelectedShelf(library.shelves[0].id)
    } else {
      setSelectedShelf('')
    }
  }

  // ========================================================================
  // CAMERA HANDLING (Reutilizar lógica de AddBookCamera)
  // ========================================================================

  const startCamera = async () => {
    try {
      setIsCameraOpen(true)

      if (!navigator.mediaDevices) {
        throw new Error('HTTPS_REQUIRED')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error('Camera error:', err)
      showToast('Could not access camera. Please use upload option.', 'error')
      setIsCameraOpen(false)
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setIsCameraOpen(false)
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current

      // Capturar con mayor resolución para mejor detección
      const MAX_WIDTH = 1920
      const scale = Math.min(1, MAX_WIDTH / video.videoWidth)
      const width = video.videoWidth * scale
      const height = video.videoHeight * scale

      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')
      if (context) {
        context.drawImage(video, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        setImage(dataUrl)
        stopCamera()
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        // Compress the uploaded image
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 1920
          const scale = Math.min(1, MAX_WIDTH / img.width)
          canvas.width = img.width * scale
          canvas.height = img.height * scale

          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8)
            setImage(compressedDataUrl)
          }
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  // ========================================================================
  // ANÁLISIS DE ESTANTERÍA
  // ========================================================================

  const handleAnalyze = async () => {
    if (!image) return

    setAnalyzing(true)
    setAnalysisResult(null)

    try {
      const result = await analyzeShelfImage(image)

      if (result.success && result.data) {
        setAnalysisResult(result.data)

        // Pre-seleccionar libros que NO están en colección Y son legibles
        const notInCollection = new Set(
          result.data.enrichedBooks
            .map((book, idx) => (!book.inCollection && book.readabilityStatus !== 'unreadable' ? idx : -1))
            .filter(idx => idx !== -1)
        )
        setSelectedBooks(notInCollection)
      } else {
        showToast(result.error || 'Failed to analyze shelf', 'error')
      }
    } catch (error) {
      console.error('Analysis error:', error)
      showToast('An error occurred during analysis', 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  // ========================================================================
  // SELECCIÓN Y AGREGADO DE LIBROS
  // ========================================================================

  const toggleBookSelection = (index: number) => {
    const newSelection = new Set(selectedBooks)
    if (newSelection.has(index)) {
      newSelection.delete(index)
    } else {
      newSelection.add(index)
    }
    setSelectedBooks(newSelection)
  }

  const handleSelectAll = () => {
    if (!analysisResult) return
    // Select all books that are NOT in collection AND are readable
    const notInCollection = new Set(
      analysisResult.enrichedBooks
        .map((book, idx) => (!book.inCollection && book.readabilityStatus !== 'unreadable' ? idx : -1))
        .filter(idx => idx !== -1)
    )
    setSelectedBooks(notInCollection)
  }

  const handleUnselectAll = () => {
    setSelectedBooks(new Set())
  }

  const handleAddSelectedBooks = async () => {
    if (!analysisResult || selectedBooks.size === 0) return
    if (!selectedShelf) {
      showToast('Please select a shelf first', 'error')
      return
    }

    setAdding(true)

    try {
      const booksToAdd = Array.from(selectedBooks)
        .map(idx => analysisResult.enrichedBooks[idx])
        .filter(book => !book.inCollection) // Solo agregar los que NO están
        .map(book => ({
          title: book.title,
          author: book.author,
          isbn: book.googleBooksData?.isbn || book.isbn,
          coverUrl: book.googleBooksData?.coverUrl,
          publisher: book.googleBooksData?.publisher,
          year: book.googleBooksData?.year,
          category: book.googleBooksData?.category,
          sourceTags: book.googleBooksData
            ? ['shelf_scan', 'google_books']
            : ['shelf_scan'],
        }))

      const result = await addMultipleBooksToShelf(booksToAdd, selectedShelf)

      if (result.success) {
        const count = result.count || 0
        showToast(`Successfully added ${count} book${count > 1 ? 's' : ''}!`, 'success')
        onComplete?.()
      } else {
        showToast(result.error || 'Failed to add books', 'error')
      }
    } catch (error) {
      console.error('Add books error:', error)
      showToast('An error occurred while adding books', 'error')
    } finally {
      setAdding(false)
    }
  }

  const handleAddSingleBook = async (index: number) => {
    if (!analysisResult) return
    if (!selectedShelf) {
      showToast('Please select a shelf first', 'error')
      return
    }

    const book = analysisResult.enrichedBooks[index]
    if (book.inCollection) return

    setAddingSingleIndex(index)

    try {
      const bookToAdd = {
        title: book.title,
        author: book.author,
        isbn: book.googleBooksData?.isbn || book.isbn,
        coverUrl: book.googleBooksData?.coverUrl,
        publisher: book.googleBooksData?.publisher,
        year: book.googleBooksData?.year,
        category: book.googleBooksData?.category,
        sourceTags: book.googleBooksData
          ? ['shelf_scan', 'google_books']
          : ['shelf_scan'],
      }

      const result = await addMultipleBooksToShelf([bookToAdd], selectedShelf)

      if (result.success) {
        // Update the book's inCollection status locally
        const updatedBooks = [...analysisResult.enrichedBooks]
        updatedBooks[index] = { ...updatedBooks[index], inCollection: true }

        setAnalysisResult({
          ...analysisResult,
          enrichedBooks: updatedBooks,
          stats: {
            ...analysisResult.stats,
            inCollection: analysisResult.stats.inCollection + 1,
            notInCollection: analysisResult.stats.notInCollection - 1,
          },
        })

        // Remove from selected books
        const newSelection = new Set(selectedBooks)
        newSelection.delete(index)
        setSelectedBooks(newSelection)

        // Show success message
        showToast(`"${book.title}" added to library!`, 'success')
      } else {
        showToast(result.error || 'Failed to add book', 'error')
      }
    } catch (error) {
      console.error('Add single book error:', error)
      showToast('An error occurred while adding the book', 'error')
    } finally {
      setAddingSingleIndex(undefined)
    }
  }

  const handleEditBeforeSave = (index: number) => {
    if (!analysisResult) return
    const book = analysisResult.enrichedBooks[index]
    setEditingBook({ index, book })
  }

  const handleManualEntrySaved = () => {
    // Book was saved via manual entry, update the UI
    if (editingBook && analysisResult) {
      const updatedBooks = [...analysisResult.enrichedBooks]
      updatedBooks[editingBook.index] = { ...updatedBooks[editingBook.index], inCollection: true }

      setAnalysisResult({
        ...analysisResult,
        enrichedBooks: updatedBooks,
        stats: {
          ...analysisResult.stats,
          inCollection: analysisResult.stats.inCollection + 1,
          notInCollection: analysisResult.stats.notInCollection - 1,
        },
      })

      // Remove from selected books
      const newSelection = new Set(selectedBooks)
      newSelection.delete(editingBook.index)
      setSelectedBooks(newSelection)

      showToast(`"${editingBook.book.title}" added to library!`, 'success')
    }

    // Return to shelf view
    setEditingBook(null)
  }

  const handleAddWithSearch = async (index: number, searchedBookData: any) => {
    if (!analysisResult) return
    if (!selectedShelf) {
      showToast('Please select a shelf first', 'error')
      return
    }

    const book = analysisResult.enrichedBooks[index]
    if (book.inCollection) return

    setAddingSingleIndex(index)

    try {
      // Use the searched book data instead of detected data
      const bookToAdd = {
        title: searchedBookData.title,
        author: searchedBookData.author,
        isbn: searchedBookData.isbn,
        coverUrl: searchedBookData.coverUrl,
        publisher: searchedBookData.publisher,
        year: searchedBookData.year,
        category: searchedBookData.category,
        sourceTags: ['shelf_scan', 'user_search', 'google_books'],
      }

      const result = await addMultipleBooksToShelf([bookToAdd], selectedShelf)

      if (result.success) {
        // Update the book's inCollection status locally
        const updatedBooks = [...analysisResult.enrichedBooks]
        updatedBooks[index] = { ...updatedBooks[index], inCollection: true }

        setAnalysisResult({
          ...analysisResult,
          enrichedBooks: updatedBooks,
          stats: {
            ...analysisResult.stats,
            inCollection: analysisResult.stats.inCollection + 1,
            notInCollection: analysisResult.stats.notInCollection - 1,
          },
        })

        // Remove from selected books
        const newSelection = new Set(selectedBooks)
        newSelection.delete(index)
        setSelectedBooks(newSelection)

        // Show success message
        showToast(`"${searchedBookData.title}" added to library!`, 'success')
      } else {
        showToast(result.error || 'Failed to add book', 'error')
      }
    } catch (error) {
      console.error('Add book with search error:', error)
      showToast('An error occurred while adding the book', 'error')
    } finally {
      setAddingSingleIndex(undefined)
    }
  }

  useEffect(() => {
    return () => stopCamera()
  }, [])

  // ========================================================================
  // RENDER
  // ========================================================================

  if (analysisResult) {
    // Calculate readable book stats
    const readableBooks = analysisResult.enrichedBooks.filter(book => book.readabilityStatus !== 'unreadable')
    const unreadableCount = analysisResult.enrichedBooks.length - readableBooks.length
    const readableStats = {
      totalDetected: readableBooks.length,
      inCollection: readableBooks.filter(b => b.inCollection).length,
      notInCollection: readableBooks.filter(b => !b.inCollection).length,
    }

    return (
      <>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Statistics - Compact version */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-center">
            <BookOpen className="mx-auto mb-1.5 text-blue-600 dark:text-blue-400" size={20} />
            <div className="text-xl font-bold">{readableStats.totalDetected}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Readable</div>
          </div>
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-center">
            <Info className="mx-auto mb-1.5 text-amber-600 dark:text-amber-400" size={20} />
            <div className="text-xl font-bold">{readableStats.inCollection}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">In Library</div>
          </div>
          <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-lg p-3 text-center">
            <CheckCircle className="mx-auto mb-1.5 text-green-600 dark:text-green-400" size={20} />
            <div className="text-xl font-bold">{readableStats.notInCollection}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">New</div>
          </div>
        </div>

        {/* Unreadable books notice */}
        {unreadableCount > 0 && (
          <div className="text-xs text-muted-foreground bg-secondary/30 border border-border rounded-lg px-3 py-2 flex items-center gap-2">
            <XCircle size={14} className="flex-shrink-0" />
            <span>{unreadableCount} book{unreadableCount !== 1 ? 's' : ''} could not be read and {unreadableCount !== 1 ? 'are' : 'is'} hidden from the list</span>
          </div>
        )}

        {/* Shelf Selector - Compact */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Library</label>
            <select
              value={selectedLibrary}
              onChange={handleLibraryChange}
              className="input-field text-sm"
            >
              <option value="">Select library</option>
              {libraries.map(lib => (
                <option key={lib.id} value={lib.id}>{lib.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Shelf</label>
            <select
              value={selectedShelf}
              onChange={(e) => setSelectedShelf(e.target.value)}
              className="input-field text-sm"
              disabled={!selectedLibrary}
            >
              <option value="">Select shelf</option>
              {selectedLibrary && libraries.find(lib => lib.id === selectedLibrary)?.shelves?.map(shelf => (
                <option key={shelf.id} value={shelf.id}>{shelf.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de libros */}
        {editingBook ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-base font-semibold">Edit Book Details</h3>
              <button
                onClick={() => setEditingBook(null)}
                className="text-xs px-2.5 py-1 bg-secondary/70 text-foreground rounded hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
            <AddBookManual
              initialData={{
                title: editingBook.book.title,
                author: editingBook.book.author,
                isbn: editingBook.book.googleBooksData?.isbn || editingBook.book.isbn,
                coverUrl: editingBook.book.googleBooksData?.coverUrl,
                publisher: editingBook.book.googleBooksData?.publisher,
                year: editingBook.book.googleBooksData?.year?.toString(),
                category: editingBook.book.googleBooksData?.category,
                sourceTags: ['shelf_scan', 'ai_enhanced'],
              }}
              defaultShelfId={selectedShelf}
              onSaveSuccess={handleManualEntrySaved}
              hideNavigation={true}
            />
          </div>
        ) : (
          <BookDetectionList
            books={analysisResult.enrichedBooks}
            selectedIndices={selectedBooks}
            onToggleSelection={toggleBookSelection}
            onSelectAll={handleSelectAll}
            onUnselectAll={handleUnselectAll}
            onAddSingle={handleAddSingleBook}
            onAddWithSearch={handleAddWithSearch}
            onEditBeforeSave={handleEditBeforeSave}
            addingSingleIndex={addingSingleIndex}
          />
        )}

        {/* Action buttons - Compact */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              setAnalysisResult(null)
              setImage(null)
              setSelectedBooks(new Set())
            }}
            className="flex-1 py-2.5 px-4 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors font-medium text-sm"
          >
            Scan Again
          </button>
          <button
            onClick={handleAddSelectedBooks}
            disabled={adding || selectedBooks.size === 0}
            className="flex-1 py-2.5 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {adding ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Adding...
              </>
            ) : (
              <>Add {selectedBooks.size} Book{selectedBooks.size !== 1 ? 's' : ''}</>
            )}
          </button>
        </div>
      </div>
      </>
    )
  }

  if (!image && !isCameraOpen) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold mb-2">Scan Your Bookshelf</h3>
          <p className="text-sm text-muted-foreground">
            Take a photo of your bookshelf and we'll detect all visible books
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
            <Info size={14} className="text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Experimental Feature - Results may vary
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-xl hover:bg-secondary/50 transition-colors"
          >
            <Upload size={32} className="text-muted-foreground" />
            <span className="text-sm font-medium">Upload Photo</span>
          </button>

          <button
            onClick={startCamera}
            className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-xl hover:bg-secondary/50 transition-colors"
          >
            <Camera size={32} className="text-muted-foreground" />
            <span className="text-sm font-medium">Take Photo</span>
          </button>

          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>

        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <h4 className="font-semibold text-sm mb-2">Tips for best results:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Ensure good lighting</li>
            <li>• Capture the shelf straight-on</li>
            <li>• Make sure book spines are clearly visible</li>
            <li>• Avoid glare and reflections</li>
          </ul>
        </div>
      </div>
    )
  }

  if (isCameraOpen) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
          <button
            onClick={stopCamera}
            className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-colors"
          >
            <X size={24} />
          </button>
          <button
            onClick={capturePhoto}
            className="p-4 rounded-full bg-white text-black hover:scale-105 transition-transform shadow-lg"
          >
            <Camera size={32} />
          </button>
        </div>
      </div>
    )
  }

  // Imagen capturada, lista para analizar
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border">
        <img src={image!} alt="Shelf" className="object-cover w-full h-full" />
        <button
          onClick={() => setImage(null)}
          className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full backdrop-blur-sm hover:bg-black/70 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={analyzing}
        className="w-full py-4 px-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {analyzing ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Analyzing Shelf...
          </>
        ) : (
          <>
            <BookOpen size={20} />
            Detect Books
          </>
        )}
      </button>

      <div className="text-center text-xs text-muted-foreground">
        This may take 10-30 seconds depending on the number of books
      </div>
    </div>
  )
}
