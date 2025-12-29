// ============================================================================
// SAM SEGMENTATION CONFIGURATION
// ============================================================================

export type SAMProvider = 'replicate' | 'huggingface'

export interface SAMConfig {
  enabled: boolean
  provider: SAMProvider
  replicateApiKey?: string
  huggingfaceApiKey?: string
  model: string
  simplificationTolerance: number  // Polygon simplification aggressiveness (0-1)
  timeout: number  // API timeout in milliseconds
}

/**
 * Get SAM configuration from environment variables
 */
export function getSAMConfig(): SAMConfig {
  const enabled = process.env.SAM_ENABLED === 'true'
  const provider = (process.env.SAM_PROVIDER || 'replicate') as SAMProvider

  return {
    enabled,
    provider,
    replicateApiKey: process.env.REPLICATE_API_KEY || '',
    huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY || '',
    model: process.env.SAM_MODEL || 'meta/sam-2',
    simplificationTolerance: 0.01,  // Convert 100+ points to ~20-40 points
    timeout: 30000,  // 30 seconds
  }
}

/**
 * Validate SAM configuration before using
 */
export function validateSAMConfig(config: SAMConfig): {
  valid: boolean
  error?: string
} {
  if (!config.enabled) {
    return { valid: false, error: 'SAM is not enabled' }
  }

  if (config.provider === 'replicate' && !config.replicateApiKey) {
    return { valid: false, error: 'REPLICATE_API_KEY is required when using Replicate provider' }
  }

  if (config.provider === 'huggingface' && !config.huggingfaceApiKey) {
    return { valid: false, error: 'HUGGINGFACE_API_KEY is required when using HuggingFace provider' }
  }

  return { valid: true }
}
