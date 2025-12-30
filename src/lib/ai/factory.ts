import { AIProvider } from './types'
import { getAIConfig, validateProviderConfig, AIProviderType } from './config'
import { OpenAIProvider } from './providers/openai-provider'
// import { AnthropicProvider } from './providers/anthropic-provider' // Futuro
// import { GoogleProvider } from './providers/google-provider' // Futuro

/**
 * Factory para crear instancias de providers de IA
 * Patrón: Factory + Strategy
 */
export class AIProviderFactory {
  private static instances = new Map<AIProviderType, AIProvider>()

  /**
   * Obtiene o crea una instancia del provider especificado
   * Usa singleton pattern para reutilizar instancias
   */
  static getProvider(type?: AIProviderType): AIProvider {
    const config = getAIConfig()
    const providerType = type || config.defaultProvider

    // Validar configuración
    validateProviderConfig(providerType)

    // Retornar instancia existente si ya fue creada
    if (this.instances.has(providerType)) {
      return this.instances.get(providerType)!
    }

    // Crear nueva instancia según el tipo
    let provider: AIProvider

    switch (providerType) {
      case 'openai':
        provider = new OpenAIProvider(config.providers.openai!)
        break

      case 'anthropic':
        throw new Error('Anthropic provider not yet implemented')
        // provider = new AnthropicProvider(config.providers.anthropic!)
        // break

      case 'google':
        throw new Error('Google provider not yet implemented')
        // provider = new GoogleProvider(config.providers.google!)
        // break

      default:
        throw new Error(`Unknown provider type: ${providerType}`)
    }

    // Cachear instancia
    this.instances.set(providerType, provider)
    return provider
  }

  /**
   * Obtiene el provider por defecto (sin especificar tipo)
   */
  static getDefaultProvider(): AIProvider {
    return this.getProvider()
  }

  /**
   * Limpia el cache de instancias (útil para testing)
   */
  static clearCache(): void {
    this.instances.clear()
  }
}

/**
 * Helper function para acceso rápido al provider por defecto
 */
export function getAIProvider(type?: AIProviderType): AIProvider {
  return AIProviderFactory.getProvider(type)
}
