/**
 * Valida formato y tamaño de imagen base64
 */
export function validateImage(
  base64Image: string,
  options: { maxSizeMB: number }
): { valid: boolean; error?: string } {
  // Verificar formato base64
  if (!base64Image.startsWith('data:image/')) {
    return { valid: false, error: 'Invalid base64 image format' }
  }

  // Calcular tamaño en MB
  const base64Length = base64Image.split(',')[1]?.length || 0
  const sizeInBytes = (base64Length * 3) / 4
  const sizeInMB = sizeInBytes / (1024 * 1024)

  if (sizeInMB > options.maxSizeMB) {
    return {
      valid: false,
      error: `Image size (${sizeInMB.toFixed(2)}MB) exceeds limit (${options.maxSizeMB}MB)`,
    }
  }

  return { valid: true }
}

/**
 * Procesa y optimiza imagen para análisis usando sharp
 */
export async function processImage(
  base64Image: string,
  options: {
    maxWidth: number
    quality: number
    format: 'jpeg' | 'png' | 'webp'
  }
): Promise<string> {
  try {
    const sharp = (await import('sharp')).default

    // Extract the base64 data and mime type
    const matches = base64Image.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) {
      return base64Image // Return unchanged if not a valid data URI
    }

    const base64Data = matches[2]
    const buffer = Buffer.from(base64Data, 'base64')

    // Process with sharp: resize and convert
    let pipeline = sharp(buffer).resize({
      width: options.maxWidth,
      withoutEnlargement: true,
    })

    // Convert to target format with quality
    const quality = Math.round(options.quality * 100)
    switch (options.format) {
      case 'webp':
        pipeline = pipeline.webp({ quality })
        break
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality })
        break
      case 'png':
        pipeline = pipeline.png({ quality })
        break
    }

    const outputBuffer = await pipeline.toBuffer()
    const outputBase64 = outputBuffer.toString('base64')
    const mimeType = options.format === 'jpeg' ? 'image/jpeg' : `image/${options.format}`

    return `data:${mimeType};base64,${outputBase64}`
  } catch (error) {
    console.warn('[ImageProcessor] sharp processing failed, returning original:', error)
    return base64Image
  }
}

/**
 * Extrae metadatos de imagen base64
 */
export function getImageMetadata(base64Image: string): {
  format: string
  sizeKB: number
} {
  const matches = base64Image.match(/^data:image\/(\w+);base64,/)
  const format = matches?.[1] || 'unknown'
  const base64Data = base64Image.split(',')[1] || ''
  const sizeKB = ((base64Data.length * 3) / 4) / 1024

  return { format, sizeKB }
}
