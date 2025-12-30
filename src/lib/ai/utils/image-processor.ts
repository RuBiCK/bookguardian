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
 * Procesa y optimiza imagen para análisis
 * (Esta función simula compresión - en producción usar librería como sharp o canvas)
 */
export async function processImage(
  base64Image: string,
  options: {
    maxWidth: number
    quality: number
    format: 'jpeg' | 'png' | 'webp'
  }
): Promise<string> {
  // En un entorno Node.js, aquí usarías sharp o canvas
  // Para este diseño, asumimos que la compresión ya se hizo en el frontend
  return base64Image
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
