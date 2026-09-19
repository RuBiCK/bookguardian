import en from './en.json' with { type: 'json' };

export const SOURCE_LOCALE = 'en' as const;
export const SUPPORTED_LOCALES = ['en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** All translation resources keyed by locale, ready to hand to i18next. */
export const resources = {
  en: { translation: en },
} as const;

export type TranslationDictionary = typeof en;

export { en };
