import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeleteAccount, useSession } from '../api/auth';
import { useBackfillStatus, useStartBackfill } from '../api/covers';
import { useHealth } from '../api/health';
import { DeleteAccountSheet } from '../components/DeleteAccountSheet';
import { Screen } from '../components/Screen';
import { showToast } from '../lib/toast';
import { THEMES, useTheme } from '../theme/useTheme';

export const Route = createFileRoute('/settings')({
  component: SettingsScreen,
});

function SettingsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();
  const health = useHealth();
  const session = useSession();
  const [deleting, setDeleting] = useState(false);
  const deleteAccount = useDeleteAccount({
    onSuccess: () => {
      setDeleting(false);
      showToast(t('settings.account.deleted'));
      // The cache is already empty; the session guard takes it from here.
      void navigate({ to: '/' });
    },
    onError: () => showToast(t('settings.account.failed'), 'error'),
  });
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
        {session.data?.email ? (
          <li className="list__row list__row--stacked" data-testid="account-row">
            <span className="list__label">{t('settings.account.label')}</span>
            <span className="list__value">
              <button
                type="button"
                className="button button--small button--danger-ghost"
                onClick={() => setDeleting(true)}
              >
                {t('settings.account.deleteAccount')}
              </button>
            </span>
            <span className="muted list__note" data-testid="account-email">
              {t('settings.account.signedInAs', { email: session.data.email })}
            </span>
          </li>
        ) : null}
        <li className="list__row">
          <span className="list__label">{t('app.name')}</span>
          <span className="list__value">{t('settings.version', { version: __APP_VERSION__ })}</span>
        </li>
      </ul>
      {session.data?.email ? (
        <DeleteAccountSheet
          open={deleting}
          email={session.data.email}
          busy={deleteAccount.isPending}
          onClose={() => setDeleting(false)}
          onConfirm={(confirmEmail) => deleteAccount.mutate({ confirmEmail })}
        />
      ) : null}
    </Screen>
  );
}
