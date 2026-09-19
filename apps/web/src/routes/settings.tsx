import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useHealth } from '../api/health';
import { Screen } from '../components/Screen';
import { THEMES, useTheme } from '../theme/useTheme';

export const Route = createFileRoute('/settings')({
  component: SettingsScreen,
});

export function SettingsScreen() {
  const { t } = useTranslation();
  const [theme, setTheme] = useTheme();
  const health = useHealth();

  const apiStatus = health.isPending
    ? t('settings.apiStatus.checking')
    : health.data
      ? t('settings.apiStatus.online', { driver: health.data.database.driver })
      : t('settings.apiStatus.offline');
  const dotClass = health.isPending
    ? 'status-dot'
    : health.data
      ? 'status-dot status-dot--ok'
      : 'status-dot status-dot--down';

  return (
    <Screen title={t('settings.title')}>
      <ul className="list">
        <li className="list__row">
          <span className="list__label">{t('settings.theme.label')}</span>
          <div className="segmented" role="group" aria-label={t('settings.theme.label')}>
            {THEMES.map((option) => (
              <button
                key={option}
                type="button"
                className="segmented__option"
                aria-pressed={theme === option}
                onClick={() => setTheme(option)}
              >
                {t(`settings.theme.${option}`)}
              </button>
            ))}
          </div>
        </li>
        <li className="list__row">
          <span className="list__label">{t('settings.apiStatus.label')}</span>
          <span className="list__value" data-testid="api-status">
            <span className={dotClass} aria-hidden="true" /> {apiStatus}
          </span>
        </li>
        <li className="list__row">
          <span className="list__label">{t('app.name')}</span>
          <span className="list__value">{t('settings.version', { version: __APP_VERSION__ })}</span>
        </li>
      </ul>
    </Screen>
  );
}
