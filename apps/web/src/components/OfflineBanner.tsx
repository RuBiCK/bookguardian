import { useTranslation } from 'react-i18next';
import { useOnline } from '../lib/online';
import { WifiOffIcon } from './icons';

/**
 * Shown at the top of every screen while the device is offline: the saved
 * copy of the library is what is on screen, and edits will not save.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;
  return (
    <div className="banner banner--offline" role="status" data-testid="offline-banner">
      <span className="banner__icon" aria-hidden="true">
        <WifiOffIcon />
      </span>
      <div className="banner__body">
        <span className="banner__title">{t('offline.title')}</span>
        <p className="banner__text">{t('offline.body')}</p>
      </div>
    </div>
  );
}
