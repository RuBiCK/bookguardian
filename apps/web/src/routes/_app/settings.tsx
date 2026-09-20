import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useLogout, useSession } from '../../api/auth';
import { useBackfillStatus, useStartBackfill } from '../../api/covers';
import { useHealth } from '../../api/health';
import { Avatar } from '../../components/Avatar';
import { Screen } from '../../components/Screen';
import { showToast } from '../../lib/toast';
import { THEMES, useTheme } from '../../theme/useTheme';

export const Route = createFileRoute('/_app/settings')({
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
      <AccountSection />
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

/** Who is signed in, and the way out. */
function AccountSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useSession();
  const logout = useLogout({
    onSuccess: () => void navigate({ to: '/login', replace: true }),
    onError: () => showToast(t('settings.account.signOutFailed'), 'error'),
  });
  const user = session.data;
  if (!user) return null;

  return (
    <section className="account" aria-labelledby="account-heading" data-testid="account">
      <h2 id="account-heading" className="account__title">
        {t('settings.account.label')}
      </h2>
      <div className="list account__card">
        <div className="list__row account__identity">
          <Avatar name={user.displayName} src={user.avatarUrl} />
          <div className="account__who">
            <span className="account__name">{user.displayName}</span>
            <span className="account__email" data-testid="account-email">
              {user.email ?? t('settings.account.noEmail')}
            </span>
            <span className="account__provider">{t('settings.account.signedInAs')}</span>
          </div>
        </div>
        <div className="list__row">
          <button
            type="button"
            className="button button--block"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            data-testid="sign-out"
          >
            {logout.isPending ? t('settings.account.signingOut') : t('settings.account.signOut')}
          </button>
        </div>
      </div>
    </section>
  );
}
