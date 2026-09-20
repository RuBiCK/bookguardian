import { useTranslation } from 'react-i18next';
import { AppMark } from './AppMark';

/** Full-screen app mark while the session is being checked on launch. */
export function Splash() {
  const { t } = useTranslation();
  return (
    <div className="splash" role="status" aria-label={t('common.loading')} data-testid="splash">
      <AppMark />
    </div>
  );
}
