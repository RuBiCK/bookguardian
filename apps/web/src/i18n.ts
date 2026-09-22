import {
  resolveLocale,
  resources,
  SOURCE_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '@bookguardian/shared/i18n';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

/** Where the landing page's language switcher remembers the choice. */
const STORAGE_KEY = 'bookguardian.locale';

/** The best supported match for the browser's language preferences. */
export function detectLocale(): Locale {
  const preferred =
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  return resolveLocale(preferred);
}

/** The locale the person picked here before, if it is still one we ship. */
export function readStoredLocale(): Locale | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const stored = localStorage.getItem(STORAGE_KEY);
  return SUPPORTED_LOCALES.find((locale) => locale === stored);
}

/** Switch language and remember it for the next launch. */
export async function setLocale(locale: Locale): Promise<void> {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, locale);
  await i18next.changeLanguage(locale);
}

export function initI18n(lng: string = readStoredLocale() ?? detectLocale()) {
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
