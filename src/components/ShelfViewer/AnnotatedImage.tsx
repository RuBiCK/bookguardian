'use client'

import { useEffect, useRef, useState } from 'react'
import { EnrichedDetectedBook } from '@/lib/ai/types'
import { pointInPolygon } from '@/lib/segmentation/polygon-utils'

interface AnnotatedImageProps {
  imageUrl: string
  books: EnrichedDetectedBook[]
}

export default function AnnotatedImage({ imageUrl, books }: AnnotatedImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [hoveredBook, setHoveredBook] = useState<EnrichedDetectedBook | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !imageRef.current) return

    const canvas = canvasRef.current
    const image = imageRef.current

    // Esperar a que la imagen cargue
    const drawAnnotations = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Ajustar canvas al tamaño de la imagen
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight

      // Dibujar imagen
      ctx.drawImage(image, 0, 0)

      // Dibujar bounding boxes o máscaras de segmentación
      books.forEach((book, index) => {
        const { x, y, width, height } = book.position

        // Convertir coordenadas normalizadas a píxeles
        const boxX = x * canvas.width
        const boxY = y * canvas.height
        const boxWidth = width * canvas.width
        const boxHeight = height * canvas.height

        // Color según estado y confianza
        const CONFIDENCE_THRESHOLD = 0.7
        let color: string
        let labelText: string

        if (book.inCollection) {
          // Verde: Ya en biblioteca
          color = '#22c55e'
          labelText = '✓ In Library'
        } else if ((book.confidence ?? 1) >= CONFIDENCE_THRESHOLD) {
          // Rojo: No en biblioteca, alta confianza
          color = '#ef4444'
          labelText = `${index + 1}`
        } else {
          // Amarillo: No en biblioteca, baja confianza (necesita revisión)
          color = '#eab308'
          labelText = `⚠ ${index + 1}`
        }

        // Dibujar máscara de segmentación (si disponible) o rectángulo
        if (book.mask && book.mask.contour.length >= 3) {
          // Dibujar polígono (máscara)
          const points = book.mask.contour.map(p => ({
            x: p.x * canvas.width,
            y: p.y * canvas.height,
          }))

          ctx.beginPath()
          ctx.moveTo(points[0].x, points[0].y)
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y)
          }
          ctx.closePath()

          // Rellenar con color semi-transparente
          ctx.fillStyle = color + '33' // 20% opacity
          ctx.fill()

          // Dibujar contorno
          ctx.strokeStyle = color
          ctx.lineWidth = 3
          ctx.stroke()
        } else {
          // Fallback: Dibujar rectángulo (comportamiento existente)
          ctx.strokeStyle = color
          ctx.lineWidth = 4
          ctx.strokeRect(boxX, boxY, boxWidth, boxHeight)
        }

        // Dibujar label (siempre sobre el bounding box para consistencia)
        const labelHeight = 28
        ctx.fillStyle = color
        ctx.fillRect(boxX, boxY - labelHeight, boxWidth, labelHeight)

        // Dibujar texto
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        ctx.fillText(labelText, boxX + boxWidth / 2, boxY - labelHeight / 2)
      })
    }

    if (image.complete) {
      drawAnnotations()
    } else {
      image.addEventListener('load', drawAnnotations)
      return () => image.removeEventListener('load', drawAnnotations)
    }
  }, [imageUrl, books])

  // Handle mouse move to detect hover over books
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    // Normalize mouse position (0-1)
    const normalizedMouse = {
      x: mouseX / canvas.width,
      y: mouseY / canvas.height,
    }

    // Check if mouse is over any book (prioritize masks over boxes)
    let foundBook: EnrichedDetectedBook | null = null
    for (const book of books) {
      // Try mask-based detection first (more accurate)
      if (book.mask?.simplifiedContour) {
        if (pointInPolygon(normalizedMouse, book.mask.simplifiedContour)) {
          foundBook = book
          break
        }
      }
      // Fallback to bounding box detection
      else {
        const { x, y, width, height } = book.position
        if (
          normalizedMouse.x >= x &&
          normalizedMouse.x <= x + width &&
          normalizedMouse.y >= y &&
          normalizedMouse.y <= y + height
        ) {
          foundBook = book
          break
        }
      }
    }

    if (foundBook) {
      setHoveredBook(foundBook)
      setTooltipPosition({ x: e.clientX, y: e.clientY })
    } else {
      setHoveredBook(null)
      setTooltipPosition(null)
    }
  }

  const handleMouseLeave = () => {
    setHoveredBook(null)
    setTooltipPosition(null)
  }

  return (
    <div className="relative bg-black rounded-xl overflow-hidden">
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Shelf"
        className="hidden"
      />
      <canvas
        ref={canvasRef}
        className="w-full h-auto cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Tooltip */}
      {hoveredBook && tooltipPosition && (
        <div
          className="fixed z-50 bg-black/90 backdrop-blur-md text-white px-3 py-2 rounded-lg shadow-lg pointer-events-none border-2"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y + 10,
            maxWidth: '300px',
            borderColor: hoveredBook.inCollection
              ? '#22c55e'
              : (hoveredBook.confidence ?? 1) >= 0.7
                ? '#ef4444'
                : '#eab308'
          }}
        >
          <div className="font-semibold text-sm">{hoveredBook.title}</div>
          {hoveredBook.author && (
            <div className="text-xs text-gray-300 mt-1">{hoveredBook.author}</div>
          )}
          {!hoveredBook.inCollection && (
            <div className="text-xs mt-2 flex items-center gap-2">
              <span className="text-gray-400">Confidence:</span>
              <span className={`font-medium ${
                (hoveredBook.confidence ?? 1) >= 0.7
                  ? 'text-green-400'
                  : 'text-yellow-400'
              }`}>
                {((hoveredBook.confidence ?? 1) * 100).toFixed(0)}%
              </span>
              {(hoveredBook.confidence ?? 1) < 0.7 && (
                <span className="text-yellow-400">⚠ Review needed</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Leyenda */}
      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md rounded-lg p-3 text-white text-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-green-500 rounded"></div>
          <span>In Your Library</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-red-500 rounded"></div>
          <span>High Confidence</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-yellow-500 rounded"></div>
          <span>⚠ Needs Review</span>
        </div>
      </div>
    </div>
  )
}
