import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useBackfillStatus, useStartBackfill } from '../api/covers';
import { useHealth } from '../api/health';
import { Screen } from '../components/Screen';
import { showToast } from '../lib/toast';
import { THEMES, useTheme } from '../theme/useTheme';

export const Route = createFileRoute('/settings')({
  component: SettingsScreen,
});

function SettingsScreen() {
  const { t } = useTranslation();
  const [theme, setTheme] = useTheme();
  const health = useHealth();
  const backfill = useBackfillStatus();
  const startBackfill = useStartBackfill({
    onSuccess: ({ queued }) => {
      if (queued === 0) showToast(t('settings.covers.nothing'));
    },
    onError: () => showToast(t('settings.covers.failed'), 'error'),
  });
  const progress = backfill.data;
  const running = startBackfill.isPending || (progress?.pending ?? 0) > 0;
  const coversText = () => {
    if (!progress || progress.queued === 0) return null;
    const done = progress.done + progress.failed;
    return progress.pending > 0
      ? t('settings.covers.progress', { done, total: progress.queued })
      : t('settings.covers.result', {
          found: progress.found,
          total: progress.queued,
          count: progress.found,
        });
  };

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
        <li className="list__row list__row--stacked">
          <span className="list__label">{t('settings.covers.label')}</span>
          <span className="list__value">
            <button
              type="button"
              className="button button--small"
              disabled={running}
              onClick={() => startBackfill.mutate()}
            >
              {running ? t('settings.covers.searching') : t('settings.covers.find')}
            </button>
          </span>
          {coversText() ? (
            <span className="muted list__note" role="status" data-testid="covers-progress">
              {coversText()}
            </span>
          ) : null}
        </li>
        <li className="list__row">
          <span className="list__label">{t('app.name')}</span>
          <span className="list__value">{t('settings.version', { version: __APP_VERSION__ })}</span>
        </li>
      </ul>
    </Screen>
  );
}
