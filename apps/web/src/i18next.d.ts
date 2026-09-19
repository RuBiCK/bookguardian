import type { TranslationDictionary } from '@bookguardian/shared/i18n';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: TranslationDictionary };
    returnNull: false;
  }
}
