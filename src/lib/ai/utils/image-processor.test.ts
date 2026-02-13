import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateImage, getImageMetadata, processImage } from './image-processor'

// Mock sharp since it's a native binary dependency
vi.mock('sharp', () => {
  const mockPipeline = {
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image-data')),
  }
  return {
    default: vi.fn(() => mockPipeline),
  }
})

// Helper: create a valid base64 data URI with a specific payload size
function makeBase64DataUri(format: string, charCount: number): string {
  // Base64 chars that are valid
  const base64Payload = 'A'.repeat(charCount)
  return `data:image/${format};base64,${base64Payload}`
}

describe('validateImage', () => {
  it('rejects non-base64 strings', () => {
    const result = validateImage('not-a-base64-image', { maxSizeMB: 5 })
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid base64 image format')
  })

  it('rejects strings that do not start with data:image/', () => {
    const result = validateImage('data:text/plain;base64,SGVsbG8=', { maxSizeMB: 5 })
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid base64 image format')
  })

  it('rejects images over maxSizeMB', () => {
    // 1 MB = 1024 * 1024 bytes. base64 ratio: bytes = (chars * 3) / 4
    // So for 2 MB we need (2 * 1024 * 1024 * 4) / 3 chars ~ 2796203 chars
    const charsFor2MB = Math.ceil((2 * 1024 * 1024 * 4) / 3)
    const bigImage = makeBase64DataUri('png', charsFor2MB)

    const result = validateImage(bigImage, { maxSizeMB: 1 })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('exceeds limit')
    expect(result.error).toContain('1MB')
  })

  it('accepts valid base64 images under the limit', () => {
    // Small image (a few bytes)
    const smallImage = makeBase64DataUri('jpeg', 100)
    const result = validateImage(smallImage, { maxSizeMB: 5 })
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('calculates size correctly', () => {
    // 400 base64 chars = (400 * 3) / 4 = 300 bytes = 300 / (1024*1024) MB
    const image = makeBase64DataUri('png', 400)
    // 300 bytes is well under 1 MB
    const result = validateImage(image, { maxSizeMB: 1 })
    expect(result.valid).toBe(true)
  })

  it('rejects image exactly at the boundary (slightly over)', () => {
    // Create exactly 1 MB: chars = (1 * 1024 * 1024 * 4) / 3 + 1 (to go slightly over)
    const charsForJustOver1MB = Math.ceil((1 * 1024 * 1024 * 4) / 3) + 4
    const image = makeBase64DataUri('png', charsForJustOver1MB)
    const result = validateImage(image, { maxSizeMB: 1 })
    expect(result.valid).toBe(false)
  })
})

describe('getImageMetadata', () => {
  it('extracts format from data URI', () => {
    const meta = getImageMetadata('data:image/png;base64,iVBORw0KGgo=')
    expect(meta.format).toBe('png')
  })

  it('extracts jpeg format', () => {
    const meta = getImageMetadata('data:image/jpeg;base64,/9j/4AAQ=')
    expect(meta.format).toBe('jpeg')
  })

  it('extracts webp format', () => {
    const meta = getImageMetadata('data:image/webp;base64,UklGR=')
    expect(meta.format).toBe('webp')
  })

  it('handles unknown format gracefully', () => {
    const meta = getImageMetadata('not-a-data-uri')
    expect(meta.format).toBe('unknown')
  })

  it('calculates size in KB', () => {
    // 1200 base64 chars -> (1200 * 3) / 4 = 900 bytes -> 900 / 1024 KB
    const image = makeBase64DataUri('png', 1200)
    const meta = getImageMetadata(image)
    const expectedKB = (1200 * 3) / 4 / 1024
    expect(meta.sizeKB).toBeCloseTo(expectedKB, 5)
  })

  it('returns 0 sizeKB for data URI with no payload', () => {
    const meta = getImageMetadata('data:image/png;base64,')
    expect(meta.sizeKB).toBe(0)
  })
})

describe('processImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns original string if not a valid data URI', async () => {
    const input = 'not-a-data-uri'
    const result = await processImage(input, {
      maxWidth: 800,
      quality: 0.8,
      format: 'jpeg',
    })
    expect(result).toBe(input)
  })

  it('processes valid jpeg data URI through sharp', async () => {
    const input = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='
    const result = await processImage(input, {
      maxWidth: 800,
      quality: 0.8,
      format: 'jpeg',
    })

    expect(result).toContain('data:image/jpeg;base64,')

    const sharp = (await import('sharp')).default
    expect(sharp).toHaveBeenCalled()
  })

  it('processes valid png data URI and converts to webp', async () => {
    const input = 'data:image/png;base64,iVBORw0KGgoAAAANS=='
    const result = await processImage(input, {
      maxWidth: 1024,
      quality: 0.9,
      format: 'webp',
    })

    expect(result).toContain('data:image/webp;base64,')
  })

  it('processes and outputs png format', async () => {
    const input = 'data:image/png;base64,iVBORw0KGgoAAAANS=='
    const result = await processImage(input, {
      maxWidth: 500,
      quality: 0.7,
      format: 'png',
    })

    expect(result).toContain('data:image/png;base64,')
  })

  it('calls sharp resize with maxWidth and withoutEnlargement', async () => {
    const input = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='
    await processImage(input, {
      maxWidth: 600,
      quality: 0.85,
      format: 'jpeg',
    })

    const sharp = (await import('sharp')).default
    const mockInstance = sharp(Buffer.from(''))
    expect(mockInstance.resize).toHaveBeenCalledWith({
      width: 600,
      withoutEnlargement: true,
    })
  })

  it('returns original on sharp error', async () => {
    // Override the mock to throw for this test
    const sharp = (await import('sharp')).default
    vi.mocked(sharp).mockImplementationOnce(() => {
      throw new Error('Sharp failed')
    })

    const input = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='
    const result = await processImage(input, {
      maxWidth: 800,
      quality: 0.8,
      format: 'jpeg',
    })

    expect(result).toBe(input)
  })
})
