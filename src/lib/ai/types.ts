// ============================================================================
// CORE TYPES - Agnóstico del provider
// ============================================================================

export interface BoundingBox {
  x: number        // Coordenada X normalizada (0-1)
  y: number        // Coordenada Y normalizada (0-1)
  width: number    // Ancho normalizado (0-1)
  height: number   // Alto normalizado (0-1)
}

export interface SegmentationMask {
  contour: Array<{x: number, y: number}>  // Polígono con coordenadas normalizadas (0-1)
  confidence?: number
  simplifiedContour?: Array<{x: number, y: number}>  // Versión simplificada para detección de hover
}

export type ReadabilityStatus = 'clear' | 'partial' | 'unreadable' | 'uncertain'

export interface DetectedBook {
  title: string
  author?: string
  isbn?: string
  position: BoundingBox
  mask?: SegmentationMask  // Opcional: máscara de segmentación (si disponible)
  confidence?: number  // Opcional: confianza del modelo (0-1)
  readabilityStatus?: ReadabilityStatus  // Estado de legibilidad del título
}

export interface ShelfAnalysisResult {
  books: DetectedBook[]
  totalDetected: number
  imageMetadata?: {
    width: number
    height: number
    format: string
  }
}

export interface SingleBookAnalysisResult {
  title: string
  author?: string
  isbn?: string
  publisher?: string
  year?: number
  category?: string
  language?: string
}

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

export interface ProviderConfig {
  apiKey: string
  model?: string
  maxTokens?: number
  temperature?: number
  timeout?: number
  retryAttempts?: number
}

export interface ImageAnalysisOptions {
  maxImageSize?: number      // Tamaño máximo en bytes
  compressionQuality?: number // Calidad JPEG (0-1)
  detectionThreshold?: number // Umbral de confianza mínimo
}

// ============================================================================
// PROVIDER INTERFACE - Contrato que todos los providers deben cumplir
// ============================================================================

export interface AIProvider {
  readonly name: string
  readonly version: string

  /**
   * Analiza una imagen de libro individual
   */
  analyzeSingleBook(
    base64Image: string,
    options?: ImageAnalysisOptions
  ): Promise<SingleBookAnalysisResult>

  /**
   * Analiza una imagen de estantería completa y detecta múltiples libros
   */
  analyzeShelf(
    base64Image: string,
    options?: ImageAnalysisOptions
  ): Promise<ShelfAnalysisResult>

  /**
   * Valida que el provider está configurado correctamente
   */
  validateConfig(): Promise<boolean>

  /**
   * Retorna información sobre límites y capacidades del provider
   */
  getCapabilities(): ProviderCapabilities
}

export interface ProviderCapabilities {
  maxImageSizeMB: number
  supportsVision: boolean
  supportsBatchProcessing: boolean
  supportsStructuredOutput: boolean
  rateLimit?: {
    requestsPerMinute: number
    tokensPerMinute: number
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export enum AIErrorCode {
  INVALID_API_KEY = 'INVALID_API_KEY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  INVALID_IMAGE_FORMAT = 'INVALID_IMAGE_FORMAT',
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  PARSING_ERROR = 'PARSING_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class AIProviderError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
    public provider: string,
    public retryable: boolean = false,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'AIProviderError'
  }
}

// ============================================================================
// USER-FACING TYPES (con verificación de colección)
// ============================================================================

export interface EnrichedDetectedBook extends DetectedBook {
  inCollection: boolean         // Si el libro ya está en la colección del usuario
  existingBookId?: string       // ID del libro si ya existe
  matchConfidence?: number      // Confianza del matching (0-1)
  googleBooksData?: {          // Datos enriquecidos de Google Books
    coverUrl?: string
    publisher?: string
    year?: number
    category?: string
    isbn?: string
  }
}

export interface ShelfAnalysisWithCollection {
  analysis: ShelfAnalysisResult
  enrichedBooks: EnrichedDetectedBook[]
  stats: {
    totalDetected: number
    inCollection: number
    notInCollection: number
  }
}
