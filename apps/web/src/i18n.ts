import { resources, SOURCE_LOCALE } from '@bookguardian/shared/i18n';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

export function initI18n(lng: string = SOURCE_LOCALE) {
  if (i18next.isInitialized) return i18next;
  void i18next.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: SOURCE_LOCALE,
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });
  return i18next;
}

export default i18next;
