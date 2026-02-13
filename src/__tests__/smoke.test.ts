/**
 * Module import smoke tests
 * Verify that all key modules can be imported without errors.
 */
import { describe, it, expect } from 'vitest'

describe('Module import smoke tests', () => {
  describe('@/lib/validation', () => {
    it('exports all validation schemas', async () => {
      const validation = await import('@/lib/validation')

      expect(validation.CreateBookSchema).toBeDefined()
      expect(validation.UpdateBookSchema).toBeDefined()
      expect(validation.CreateLibrarySchema).toBeDefined()
      expect(validation.CreateShelfSchema).toBeDefined()
      expect(validation.CreateLendingSchema).toBeDefined()
      expect(validation.UpdateUserSchema).toBeDefined()
    })

    it('schemas have a parse method (are Zod schemas)', async () => {
      const {
        CreateBookSchema,
        UpdateBookSchema,
        CreateLibrarySchema,
        CreateShelfSchema,
        CreateLendingSchema,
        UpdateUserSchema,
      } = await import('@/lib/validation')

      expect(typeof CreateBookSchema.parse).toBe('function')
      expect(typeof UpdateBookSchema.parse).toBe('function')
      expect(typeof CreateLibrarySchema.parse).toBe('function')
      expect(typeof CreateShelfSchema.parse).toBe('function')
      expect(typeof CreateLendingSchema.parse).toBe('function')
      expect(typeof UpdateUserSchema.parse).toBe('function')
    })
  })

  describe('@/lib/rate-limit', () => {
    it('exports rateLimit function', async () => {
      const rateLimitModule = await import('@/lib/rate-limit')

      expect(rateLimitModule.rateLimit).toBeDefined()
      expect(typeof rateLimitModule.rateLimit).toBe('function')
    })

    it('exports rateLimitResponse function', async () => {
      const rateLimitModule = await import('@/lib/rate-limit')

      expect(rateLimitModule.rateLimitResponse).toBeDefined()
      expect(typeof rateLimitModule.rateLimitResponse).toBe('function')
    })
  })

  describe('@/lib/ai/utils/image-processor', () => {
    it('exports validateImage function', async () => {
      const imageProcessor = await import('@/lib/ai/utils/image-processor')

      expect(imageProcessor.validateImage).toBeDefined()
      expect(typeof imageProcessor.validateImage).toBe('function')
    })

    it('exports processImage function', async () => {
      const imageProcessor = await import('@/lib/ai/utils/image-processor')

      expect(imageProcessor.processImage).toBeDefined()
      expect(typeof imageProcessor.processImage).toBe('function')
    })

    it('exports getImageMetadata function', async () => {
      const imageProcessor = await import('@/lib/ai/utils/image-processor')

      expect(imageProcessor.getImageMetadata).toBeDefined()
      expect(typeof imageProcessor.getImageMetadata).toBe('function')
    })
  })

  describe('@/lib/ai/config', () => {
    it('exports getAIConfig function', async () => {
      const config = await import('@/lib/ai/config')

      expect(config.getAIConfig).toBeDefined()
      expect(typeof config.getAIConfig).toBe('function')
    })

    it('getAIConfig returns expected shape', async () => {
      const { getAIConfig } = await import('@/lib/ai/config')
      const aiConfig = getAIConfig()

      expect(aiConfig).toHaveProperty('defaultProvider')
      expect(aiConfig).toHaveProperty('providers')
      expect(aiConfig).toHaveProperty('imageProcessing')
      expect(aiConfig).toHaveProperty('detection')

      // Verify providers sub-properties
      expect(aiConfig.providers).toHaveProperty('openai')
      expect(aiConfig.providers).toHaveProperty('anthropic')
      expect(aiConfig.providers).toHaveProperty('google')

      // Verify imageProcessing sub-properties
      expect(aiConfig.imageProcessing).toHaveProperty('maxSizeMB')
      expect(aiConfig.imageProcessing).toHaveProperty('compressionQuality')
      expect(aiConfig.imageProcessing).toHaveProperty('defaultFormat')

      // Verify detection sub-properties
      expect(aiConfig.detection).toHaveProperty('minConfidenceThreshold')
      expect(aiConfig.detection).toHaveProperty('maxBooksPerShelf')
    })

    it('exports validateProviderConfig function', async () => {
      const config = await import('@/lib/ai/config')

      expect(config.validateProviderConfig).toBeDefined()
      expect(typeof config.validateProviderConfig).toBe('function')
    })
  })

  describe('@/lib/quota-config', () => {
    it('exports QUOTA_TIERS', async () => {
      const quotaConfig = await import('@/lib/quota-config')

      expect(quotaConfig.QUOTA_TIERS).toBeDefined()
    })

    it('QUOTA_TIERS has FREE, PRO, and UNLIMITED tiers', async () => {
      const { QUOTA_TIERS } = await import('@/lib/quota-config')

      expect(QUOTA_TIERS).toHaveProperty('FREE')
      expect(QUOTA_TIERS).toHaveProperty('PRO')
      expect(QUOTA_TIERS).toHaveProperty('UNLIMITED')
    })

    it('each tier has expected properties', async () => {
      const { QUOTA_TIERS } = await import('@/lib/quota-config')

      for (const tier of Object.values(QUOTA_TIERS)) {
        expect(tier).toHaveProperty('monthlyTokens')
        expect(tier).toHaveProperty('monthlyCalls')
        expect(tier).toHaveProperty('name')
        expect(tier).toHaveProperty('features')
        expect(typeof tier.monthlyTokens).toBe('number')
        expect(typeof tier.monthlyCalls).toBe('number')
        expect(typeof tier.name).toBe('string')
        expect(Array.isArray(tier.features)).toBe(true)
      }
    })
  })
})
