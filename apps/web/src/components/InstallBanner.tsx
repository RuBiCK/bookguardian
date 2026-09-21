import { useTranslation } from 'react-i18next';
import { useInstallPrompt } from '../lib/install';
import { useStoredValue } from '../lib/stored-value';
import { DownloadIcon, ShareIcon } from './icons';

export const INSTALL_DISMISSED_KEY = 'bookguardian.installDismissed';

/**
 * A one-time invitation on the Library tab to put the app on the home
 * screen: a real install button where the browser offers one, the Share
 * instructions on iOS. "Not now" hides it for good; Settings keeps the
 * option.
 */
export function InstallBanner() {
  const { t } = useTranslation();
  const { platform, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useStoredValue(INSTALL_DISMISSED_KEY, ['0', '1'], '0');
  if (dismissed === '1' || (platform !== 'prompt' && platform !== 'ios')) return null;

  return (
    <div className="banner banner--install" data-testid="install-banner">
      <span className="banner__icon" aria-hidden="true">
        {platform === 'ios' ? <ShareIcon /> : <DownloadIcon />}
      </span>
      <div className="banner__body">
        <span className="banner__title">{t('install.title')}</span>
        <p className="banner__text">{platform === 'ios' ? t('install.ios') : t('install.body')}</p>
      </div>
      <div className="banner__actions">
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => setDismissed('1')}
        >
          {t('install.dismiss')}
        </button>
        {platform === 'prompt' ? (
          <button
            type="button"
            className="button button--primary button--small"
            onClick={() => void install()}
          >
            {t('install.button')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
