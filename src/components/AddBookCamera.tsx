'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, X, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'

import { analyzeBookImage } from '@/app/actions/analyze-book'

interface BookOption {
    title: string
    author?: string
    isbn?: string
    coverUrl?: string
    category?: string
    year?: number
    publisher?: string
    language?: string
}

interface AddBookCameraProps {
    onScanComplete: (data: any) => void
}

export default function AddBookCamera({ onScanComplete }: AddBookCameraProps) {
    const [image, setImage] = useState<string | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const [multipleOptions, setMultipleOptions] = useState<BookOption[]>([])
    const [aiData, setAiData] = useState<any>(null)
    const [captureMethod, setCaptureMethod] = useState<'camera' | 'upload' | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const startCamera = async () => {
        try {
            setIsCameraOpen(true)

            // Check if mediaDevices API is available (undefined in non-secure contexts on iOS Safari)
            if (!navigator.mediaDevices) {
                throw new Error('HTTPS_REQUIRED')
            }

            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
        } catch (err) {
            console.error("Error accessing camera:", err)

            // Provide specific guidance based on error type
            if (err instanceof Error && err.message === 'HTTPS_REQUIRED') {
                alert("Camera access requires HTTPS. Please access this site using https:// or use the 'Upload Photo' option instead.")
            } else {
                alert("Could not access camera. Please ensure permissions are granted.")
            }
            setIsCameraOpen(false)
        }
    }

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream
            stream.getTracks().forEach(track => track.stop())
            videoRef.current.srcObject = null
        }
        setIsCameraOpen(false)
    }

    const capturePhoto = () => {
        setCaptureMethod('camera')
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current
            const canvas = canvasRef.current
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            const context = canvas.getContext('2d')
            if (context) {
                // Resize logic
                const MAX_WIDTH = 800
                const scale = MAX_WIDTH / video.videoWidth
                const width = Math.min(video.videoWidth, MAX_WIDTH)
                const height = video.videoHeight * (scale < 1 ? scale : 1)

                canvas.width = width
                canvas.height = height

                context.drawImage(video, 0, 0, width, height)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8) // Add compression
                console.log('Captured image size:', dataUrl.length)
                setImage(dataUrl)
                stopCamera()
            }
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCaptureMethod('upload')
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setImage(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleAnalyze = async () => {
        console.log('Starting analysis...')
        if (!image) {
            console.log('No image to analyze')
            return
        }
        setAnalyzing(true)

        try {
            console.log('Calling server action...')
            const result = await analyzeBookImage(image)
            console.log('Server action result:', result)
            if (result.error) {
                alert(result.error)
            } else if (result.multipleOptions && result.multipleOptions.length > 1) {
                // Show selection list
                setMultipleOptions(result.multipleOptions)
                setAiData(result.data)
            } else if (result.data) {
                // Añadir source tag basado en método de captura
                const sourceType = captureMethod === 'camera' ? 'camera_live' : 'photo_upload'
                const enrichedData = {
                    ...result.data,
                    sourceTags: [sourceType],
                }
                onScanComplete(enrichedData)
            }
        } catch (error) {
            console.error(error)
            alert('An error occurred during analysis')
        } finally {
            setAnalyzing(false)
        }
    }

    const handleSelectBook = (selectedBook: BookOption) => {
        // Merge AI data with selected book data
        const sourceType = captureMethod === 'camera' ? 'camera_live' : 'photo_upload'
        const mergedData = {
            ...aiData,
            ...selectedBook,
            sourceTags: [sourceType],
        }
        onScanComplete(mergedData)
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCamera()
        }
    }, [])

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {multipleOptions.length > 0 ? (
                // Show selection list
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Select Book Edition</h3>
                        <button
                            onClick={() => {
                                setMultipleOptions([])
                                setAiData(null)
                            }}
                            className="p-2 hover:bg-secondary rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <p className="text-sm text-muted-foreground">Multiple editions found. Select the correct one:</p>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {multipleOptions.map((book, index) => (
                            <button
                                key={index}
                                onClick={() => handleSelectBook(book)}
                                className="w-full flex gap-4 p-4 bg-card border border-border rounded-xl hover:bg-secondary/50 transition-all text-left group"
                            >
                                {book.coverUrl && (
                                    <img
                                        src={book.coverUrl}
                                        alt={book.title}
                                        className="w-16 h-24 object-cover rounded-lg shadow-sm"
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                                        {book.title}
                                    </h4>
                                    {book.author && (
                                        <p className="text-xs text-muted-foreground mt-1">{book.author}</p>
                                    )}
                                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                                        {book.isbn && (
                                            <span className="px-2 py-1 bg-secondary rounded">ISBN: {book.isbn}</span>
                                        )}
                                        {book.year && (
                                            <span className="px-2 py-1 bg-secondary rounded">{book.year}</span>
                                        )}
                                        {book.publisher && (
                                            <span className="px-2 py-1 bg-secondary rounded truncate max-w-[150px]">{book.publisher}</span>
                                        )}
                                    </div>
                                </div>
                                <CheckCircle2 className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" size={24} />
                            </button>
                        ))}
                    </div>
                </div>
            ) : !image && !isCameraOpen ? (
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
            ) : isCameraOpen ? (
                <div className="relative overflow-hidden rounded-xl bg-black aspect-[3/4]">
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
            ) : (
                <div className="space-y-4">
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-border">
                        <img src={image!} alt="Capture" className="object-cover w-full h-full" />
                        <button
                            onClick={() => setImage(null)}
                            className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full backdrop-blur-sm hover:bg-black/70 transition-colors"
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="w-full btn-primary flex items-center justify-center gap-2"
                    >
                        {analyzing ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Analyzing Book...
                            </>
                        ) : (
                            <>
                                <Camera size={20} />
                                Analyze Cover
                            </>
                        )}
                    </button>
                </div>
            )}

            {!multipleOptions.length && (
                <div className="text-center text-xs text-muted-foreground">
                    {isCameraOpen ? "Position the book cover in the frame." : "Take a clear photo of the book cover or spine."}
                </div>
            )}
        </div>
    )
}
