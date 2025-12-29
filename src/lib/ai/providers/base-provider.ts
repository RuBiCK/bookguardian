import {
  AIProvider,
  ProviderConfig,
  SingleBookAnalysisResult,
  ShelfAnalysisResult,
  ImageAnalysisOptions,
  ProviderCapabilities,
  AIProviderError,
  AIErrorCode,
} from '../types'
import { processImage, validateImage } from '../utils/image-processor'

/**
 * Clase base abstracta que implementa Template Method Pattern
 * Define el flujo común y delega los detalles a las subclases
 */
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string
  abstract readonly version: string

  protected config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = config
  }

  // ========================================================================
  // MÉTODOS PÚBLICOS (Template Methods)
  // ========================================================================

  async analyzeSingleBook(
    base64Image: string,
    options?: ImageAnalysisOptions
  ): Promise<SingleBookAnalysisResult> {
    try {
      // 1. Validar imagen
      await this.validateImageInput(base64Image, options)

      // 2. Pre-procesar imagen (común para todos los providers)
      const processedImage = await this.preprocessImage(base64Image, options)

      // 3. Llamar al método específico del provider (abstract)
      const result = await this.callSingleBookAPI(processedImage, options)

      // 4. Post-procesar respuesta (normalizar formato)
      return this.normalizeSingleBookResponse(result)
    } catch (error) {
      throw this.handleError(error, 'analyzeSingleBook')
    }
  }

  async analyzeShelf(
    base64Image: string,
    options?: ImageAnalysisOptions
  ): Promise<ShelfAnalysisResult> {
    try {
      // 1. Validar imagen
      await this.validateImageInput(base64Image, options)

      // 2. Pre-procesar imagen
      const processedImage = await this.preprocessImage(base64Image, options)

      // 3. Llamar al método específico del provider (abstract)
      const result = await this.callShelfAnalysisAPI(processedImage, options)

      // 4. Post-procesar respuesta
      return this.normalizeShelfResponse(result)
    } catch (error) {
      throw this.handleError(error, 'analyzeShelf')
    }
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      throw new AIProviderError(
        AIErrorCode.INVALID_API_KEY,
        'API key is missing',
        this.name
      )
    }
    return true
  }

  abstract getCapabilities(): ProviderCapabilities

  // ========================================================================
  // MÉTODOS ABSTRACTOS (Implementados por subclases)
  // ========================================================================

  /**
   * Llamada real al API para análisis de libro individual
   */
  protected abstract callSingleBookAPI(
    base64Image: string,
    options?: ImageAnalysisOptions
  ): Promise<any>

  /**
   * Llamada real al API para análisis de estantería
   */
  protected abstract callShelfAnalysisAPI(
    base64Image: string,
    options?: ImageAnalysisOptions
  ): Promise<any>

  /**
   * Convierte la respuesta del provider a formato estándar para libro individual
   */
  protected abstract normalizeSingleBookResponse(apiResponse: any): SingleBookAnalysisResult

  /**
   * Convierte la respuesta del provider a formato estándar para estantería
   */
  protected abstract normalizeShelfResponse(apiResponse: any): ShelfAnalysisResult

  // ========================================================================
  // MÉTODOS COMUNES (Shared Logic)
  // ========================================================================

  protected async validateImageInput(
    base64Image: string,
    options?: ImageAnalysisOptions
  ): Promise<void> {
    const validation = validateImage(base64Image, {
      maxSizeMB: options?.maxImageSize || 5,
    })

    if (!validation.valid) {
      throw new AIProviderError(
        AIErrorCode.INVALID_IMAGE_FORMAT,
        validation.error || 'Invalid image format',
        this.name
      )
    }
  }

  protected async preprocessImage(
    base64Image: string,
    options?: ImageAnalysisOptions
  ): Promise<string> {
    return processImage(base64Image, {
      maxWidth: 2048,
      quality: options?.compressionQuality || 0.85,
      format: 'jpeg',
    })
  }

  protected handleError(error: unknown, operation: string): AIProviderError {
    if (error instanceof AIProviderError) {
      return error
    }

    // Mapear errores comunes
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return new AIProviderError(
          AIErrorCode.RATE_LIMIT_EXCEEDED,
          'Rate limit exceeded. Please try again later.',
          this.name,
          true,
          error
        )
      }

      if (error.message.includes('timeout')) {
        return new AIProviderError(
          AIErrorCode.NETWORK_ERROR,
          'Request timed out',
          this.name,
          true,
          error
        )
      }
    }

    return new AIProviderError(
      AIErrorCode.UNKNOWN_ERROR,
      `Failed to ${operation}`,
      this.name,
      false,
      error
    )
  }
}
