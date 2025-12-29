import OpenAI from 'openai'
import {
  SingleBookAnalysisResult,
  ShelfAnalysisResult,
  ImageAnalysisOptions,
  ProviderCapabilities,
  AIProviderError,
  AIErrorCode,
  DetectedBook,
  BoundingBox,
} from '../types'
import { BaseAIProvider } from './base-provider'

interface OpenAIConfig {
  apiKey: string
  model: string
  organization?: string
}

/**
 * Implementación del provider para OpenAI GPT-4 Vision
 */
export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'OpenAI'
  readonly version = '1.0.0'

  private client: OpenAI
  private model: string

  constructor(config: OpenAIConfig) {
    super({
      apiKey: config.apiKey,
      model: config.model,
      maxTokens: 4096,
      temperature: 0.1, // Baja temperatura para respuestas más consistentes
    })

    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
    })

    this.model = config.model
  }

  // ========================================================================
  // IMPLEMENTACIÓN DE MÉTODOS ABSTRACTOS
  // ========================================================================

  protected async callSingleBookAPI(
    base64Image: string,
    options?: ImageAnalysisOptions
  ): Promise<any> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.getSingleBookPrompt(),
            },
            {
              type: 'image_url',
              image_url: { url: base64Image },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new AIProviderError(
        AIErrorCode.PARSING_ERROR,
        'Empty response from OpenAI',
        this.name
      )
    }

    return JSON.parse(content)
  }

  protected async callShelfAnalysisAPI(
    base64Image: string,
    options?: ImageAnalysisOptions
  ): Promise<any> {
    console.log('[OpenAI] Calling shelf analysis API...')
    console.log('[OpenAI] Image size:', base64Image.length, 'characters')

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.getShelfAnalysisPrompt(),
            },
            {
              type: 'image_url',
              image_url: { url: base64Image },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096, // Mayor límite para múltiples libros
      temperature: 0.1,
    })

    console.log('[OpenAI] Response received')
    console.log('[OpenAI] Choices:', response.choices?.length)
    console.log('[OpenAI] Finish reason:', response.choices?.[0]?.finish_reason)

    const message = response.choices[0]?.message
    const content = message?.content
    const refusal = message?.refusal

    // Check for refusal (OpenAI safety feature)
    if (refusal) {
      console.error('[OpenAI] Request refused:', refusal)
      throw new AIProviderError(
        AIErrorCode.MODEL_UNAVAILABLE,
        `OpenAI refused the request: ${refusal}. This might be due to content policy restrictions on the image. Please try a different photo.`,
        this.name,
        true  // retryable
      )
    }

    if (!content) {
      console.error('[OpenAI] Empty content. Full response:', JSON.stringify(response, null, 2))
      throw new AIProviderError(
        AIErrorCode.PARSING_ERROR,
        `Empty response from OpenAI. Finish reason: ${response.choices?.[0]?.finish_reason || 'unknown'}`,
        this.name
      )
    }

    console.log('[OpenAI] Content length:', content.length)
    return JSON.parse(content)
  }

  protected normalizeSingleBookResponse(apiResponse: any): SingleBookAnalysisResult {
    return {
      title: apiResponse.title || 'Unknown',
      author: apiResponse.author || undefined,
      isbn: apiResponse.isbn || undefined,
      publisher: apiResponse.publisher || undefined,
      year: apiResponse.year ? parseInt(apiResponse.year) : undefined,
      category: apiResponse.category || undefined,
      language: apiResponse.language || undefined,
    }
  }

  protected normalizeShelfResponse(apiResponse: any): ShelfAnalysisResult {
    const books: DetectedBook[] = (apiResponse.books || []).map((book: any) => {
      const { cleanTitle, readabilityStatus } = this.extractReadabilityStatus(book.title)
      // Also clean author field if it has prefixes
      const cleanAuthor = book.author ? this.cleanField(book.author) : undefined

      return {
        title: cleanTitle,
        author: cleanAuthor,
        isbn: book.isbn || undefined,
        position: this.normalizeBoundingBox(book.position),
        confidence: book.confidence ? parseFloat(book.confidence) : undefined,
        readabilityStatus,
      }
    })

    return {
      books,
      totalDetected: books.length,
      imageMetadata: apiResponse.imageMetadata,
    }
  }

  /**
   * Extract readability status prefix from title and return clean title
   */
  private extractReadabilityStatus(title: string): { cleanTitle: string, readabilityStatus?: 'clear' | 'partial' | 'unreadable' | 'uncertain' } {
    if (!title) return { cleanTitle: title }

    if (title.startsWith('[partial]')) {
      return {
        cleanTitle: title.replace('[partial]', '').trim(),
        readabilityStatus: 'partial'
      }
    }

    if (title.startsWith('[unreadable]')) {
      return {
        cleanTitle: title.replace('[unreadable]', '').trim(),
        readabilityStatus: 'unreadable'
      }
    }

    if (title.startsWith('[uncertain]')) {
      return {
        cleanTitle: title.replace('[uncertain]', '').trim(),
        readabilityStatus: 'uncertain'
      }
    }

    return { cleanTitle: title, readabilityStatus: 'clear' }
  }

  /**
   * Clean any field from readability prefixes (without extracting status)
   */
  private cleanField(field: string): string {
    if (!field) return field

    return field
      .replace(/^\[partial\]\s*/i, '')
      .replace(/^\[unreadable\]\s*/i, '')
      .replace(/^\[uncertain\]\s*/i, '')
      .trim()
  }

  getCapabilities(): ProviderCapabilities {
    return {
      maxImageSizeMB: 20,
      supportsVision: true,
      supportsBatchProcessing: false,
      supportsStructuredOutput: true,
      rateLimit: {
        requestsPerMinute: 500,
        tokensPerMinute: 30000,
      },
    }
  }

  // ========================================================================
  // PROMPTS ESPECÍFICOS DE OPENAI
  // ========================================================================

  private getSingleBookPrompt(): string {
    return `Analyze this book cover and extract the following information in JSON format:
{
  "title": "book title",
  "author": "author name",
  "isbn": "ISBN if visible",
  "publisher": "publisher name",
  "year": year as number,
  "category": "book category",
  "language": "2-letter language code"
}

If a field is not visible, use null. Be precise and extract only visible information.`
  }

  private getShelfAnalysisPrompt(): string {
    return `You are helping me catalog books from my personal library bookshelf. Please identify ALL visible books in this photo.

IMPORTANT ABOUT BOOK ORIENTATIONS:
- Books are TYPICALLY standing vertically on the shelf
- Some books may be angled or leaning
- Some books may be lying horizontally (less common)
- The text on book spines can be oriented in different ways:
  * Some spine text reads TOP-TO-BOTTOM (common in English publishing)
  * Some spine text reads BOTTOM-TO-TOP (common in European publishing)
  * Some spine text may wrap around the spine
- You may need to mentally rotate the text to read it correctly depending on the book's position

For each book, please provide:
1. Title (as shown on spine or cover)
2. Author (if visible)
3. ISBN (if visible)
4. Location coordinates on the shelf (normalized 0-1 scale where 0,0 is top-left and 1,1 is bottom-right)
5. How confident you are in your reading (0-1)

Return a JSON object with this structure:
{
  "books": [
    {
      "title": "Book Title",
      "author": "Author Name or null",
      "isbn": "ISBN if visible or null",
      "position": {
        "x": 0.1,
        "y": 0.2,
        "width": 0.05,
        "height": 0.7
      },
      "confidence": 0.95
    }
  ]
}

CRITICAL: BE HONEST ABOUT READABILITY
- If you CANNOT read the title clearly, use "[unreadable]" as the title
- If you can only read PART of the title, prefix it with "[partial] " and only include what you can actually read
- If you're GUESSING or not 100% certain, use "[uncertain] " prefix
- NEVER invent or guess titles when text is blurry, occluded, or at a bad angle
- NEVER make up words that you cannot clearly see
- It's better to mark something as unreadable than to guess incorrectly

CONFIDENCE SCORING (VERY IMPORTANT):
- 0.9-1.0: Title is crystal clear, fully readable, no doubt
- 0.7-0.89: Title is readable but some letters might be unclear or lighting is suboptimal
- 0.5-0.69: Title is partially readable, significant uncertainty, bad angle or blur
- 0.3-0.49: Can barely make out some letters, mostly guessing
- 0.0-0.29: Cannot read title at all, pure guess

Be CONSERVATIVE with confidence scores. If in doubt, lower the score.

LOCATION INSTRUCTIONS - IMPORTANT FOR ORGANIZING:
⚠️ EACH BOOK HAS ITS OWN WIDTH - Different books take up different space on the shelf!

For EACH individual book spine:
1. Note where the LEFT edge begins (where this book starts)
2. Note where the RIGHT edge ends (where this book ends)
3. Calculate the width: RIGHT edge minus LEFT edge
4. Measure carefully - thick books are wider (0.05-0.15), thin books are narrower (0.01-0.04)

Coordinates (all normalized 0-1):
- x: Left edge position of THIS specific book
- y: Top edge of the book
- width: ACTUAL measured width of THIS specific book spine (varies per book!)
- height: Full height of the book

EXAMPLES of DIFFERENT book widths:
- Thin paperback: width = 0.015 (very narrow)
- Normal book: width = 0.03-0.05
- Thick hardcover: width = 0.08-0.12
- Very thick book: width = 0.15+

⚠️ MEASURE EACH BOOK INDIVIDUALLY - widths should vary significantly!
⚠️ DO NOT use a constant width for all books - this is incorrect!

OTHER NOTES:
- Please list ALL visible books, no matter how many
- Order books from left to right, top to bottom
- If author is not visible, use null
- Account for the actual orientation of books (they may be at an angle if photo is tilted)
- Location boxes may overlap slightly if books are leaning or photo is angled - this is normal`
  }

  private normalizeBoundingBox(position: any): BoundingBox {
    return {
      x: Math.max(0, Math.min(1, parseFloat(position.x || 0))),
      y: Math.max(0, Math.min(1, parseFloat(position.y || 0))),
      width: Math.max(0, Math.min(1, parseFloat(position.width || 0.1))),
      height: Math.max(0, Math.min(1, parseFloat(position.height || 0.1))),
    }
  }
}
