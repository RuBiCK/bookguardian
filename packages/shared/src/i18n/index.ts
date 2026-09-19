import en from './en.json' with { type: 'json' };
import es from './es.json' with { type: 'json' };

export const SOURCE_LOCALE = 'en' as const;
export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** All translation resources keyed by locale, ready to hand to i18next. */
export const resources = {
  en: { translation: en },
  es: { translation: es },
} as const;

/** English is the source: every other dictionary must carry exactly its keys. */
export type TranslationDictionary = typeof en;

/**
 * Pick the supported locale that best matches the user's preferences
 * (`navigator.languages`): exact tag first, then the language part
 * ("es-MX" → "es"), else the source locale.
 */
export function resolveLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    const exact = SUPPORTED_LOCALES.find((locale) => locale === lower);
    if (exact) return exact;
    const language = lower.split('-')[0];
    const partial = SUPPORTED_LOCALES.find((locale) => locale === language);
    if (partial) return partial;
  }
  return SOURCE_LOCALE;
}

export { en, es };
