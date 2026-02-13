// ============================================================================
// CONFIGURACIÓN CENTRALIZADA DE PROVIDERS
// ============================================================================

export type AIProviderType = 'openai' | 'anthropic' | 'google'

export interface AIConfig {
  defaultProvider: AIProviderType
  providers: {
    openai?: {
      apiKey: string
      model: string
      organization?: string
    }
    anthropic?: {
      apiKey: string
      model: string
    }
    google?: {
      apiKey: string
      model: string
    }
  }
  imageProcessing: {
    maxSizeMB: number
    compressionQuality: number
    defaultFormat: 'jpeg' | 'png' | 'webp'
  }
  detection: {
    minConfidenceThreshold: number
    maxBooksPerShelf: number
  }
}

/**
 * Carga la configuración desde variables de entorno
 * CAMBIAR EL PROVIDER AQUÍ CON UNA SOLA LÍNEA
 */
export function getAIConfig(): AIConfig {
  return {
    // ⚠️ CAMBIO DE PROVIDER: Solo cambiar esta línea
    defaultProvider: (process.env.AI_PROVIDER as AIProviderType) || 'openai',

    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        organization: process.env.OPENAI_ORG,
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      },
      google: {
        apiKey: process.env.GOOGLE_AI_API_KEY || '',
        model: process.env.GOOGLE_MODEL || 'gemini-1.5-pro',
      },
    },

    imageProcessing: {
      maxSizeMB: 5,
      compressionQuality: 0.85,
      defaultFormat: 'webp',
    },

    detection: {
      minConfidenceThreshold: 0.7,
      maxBooksPerShelf: 100, // Límite de seguridad
    },
  }
}

/**
 * Valida que el provider configurado tiene las credenciales necesarias
 */
export function validateProviderConfig(provider: AIProviderType): boolean {
  const config = getAIConfig()
  const providerConfig = config.providers[provider]

  if (!providerConfig) {
    throw new Error(`Provider "${provider}" not configured`)
  }

  if (!providerConfig.apiKey) {
    throw new Error(`API key missing for provider "${provider}"`)
  }

  return true
}
