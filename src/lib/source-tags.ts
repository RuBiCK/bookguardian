/**
 * Source Tags Helper Functions
 *
 * Utilities for managing metadata source tags with "source:" prefix
 */

/**
 * Convierte nombre de fuente a tag con prefijo
 * @example createSourceTag('google_books') => 'source:google_books'
 */
export function createSourceTag(source: string): string {
  return `source:${source}`
}

/**
 * Verifica si un tag es de fuente
 * @example isSourceTag('source:manual') => true
 * @example isSourceTag('sci-fi') => false
 */
export function isSourceTag(tag: string): boolean {
  return tag.startsWith('source:')
}

/**
 * Extrae nombre de fuente desde tag
 * @example getSourceName('source:google_books') => 'google_books'
 */
export function getSourceName(tag: string): string {
  return tag.replace('source:', '')
}

/**
 * Formatea nombre de fuente para display en UI
 * @example formatSourceName('source:google_books') => 'Google Books'
 */
export function formatSourceName(tag: string): string {
  const source = getSourceName(tag)
  const names: Record<string, string> = {
    'manual': 'Manual Entry',
    'google_books': 'Google Books',
    'shelf_scan': 'Shelf Scan',
    'camera_live': 'Camera (Live)',
    'photo_upload': 'Photo Upload',
    'user_search': 'User Search',
    'isbn_search': 'ISBN Search',
  }
  return names[source] || source
}

/**
 * Separa tags de usuario de tags de fuentes
 * @param tags Array de tags con estructura { name: string }
 * @returns Objeto con sourceTags y userTags separados
 */
export function separateTags(tags: Array<{ name: string }>) {
  return {
    sourceTags: tags.filter(t => isSourceTag(t.name)),
    userTags: tags.filter(t => !isSourceTag(t.name)),
  }
}
