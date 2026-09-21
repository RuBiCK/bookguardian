import { resolveLocale, resources, SOURCE_LOCALE, type Locale } from '@bookguardian/shared/i18n';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

/** The best supported match for the browser's language preferences. */
export function detectLocale(): Locale {
  const preferred =
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  return resolveLocale(preferred);
}

export function initI18n(lng: string = detectLocale()) {
  if (i18next.isInitialized) return i18next;
  void i18next.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: SOURCE_LOCALE,
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });
  // Screen readers pick the voice from <html lang>; keep it honest.
  const syncLang = (language: string) => {
    if (typeof document !== 'undefined') document.documentElement.lang = language;
  };
  syncLang(i18next.language ?? lng);
  i18next.on('languageChanged', syncLang);
  return i18next;
}

export default i18next;
