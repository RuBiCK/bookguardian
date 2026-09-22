import { SUPPORTED_LOCALES } from '@bookguardian/shared/i18n';
import { useTranslation } from 'react-i18next';
import { setLocale } from '../i18n';

/**
 * EN / ES, in the landing footer. The choice is remembered across launches
 * (see `setLocale`); without one the browser's language list decides.
 */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div className="segmented" role="group" aria-label={t('landing.footer.language')}>
      {SUPPORTED_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          className="segmented__option"
          aria-pressed={locale === current}
          onClick={() => void setLocale(locale)}
        >
          {t(`landing.footer.languages.${locale}`)}
        </button>
      ))}
    </div>
  );
}
