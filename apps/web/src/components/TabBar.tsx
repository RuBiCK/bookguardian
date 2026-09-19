import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { TABS } from './tabs';

export function TabBar() {
  const { t } = useTranslation();
  return (
    <nav className="tabbar" aria-label={t('app.name')} data-testid="tabbar">
      {TABS.map(({ to, labelKey, Icon }) => (
        <Link
          key={to}
          to={to}
          className="tabbar__item"
          activeOptions={{ exact: to === '/' }}
          activeProps={{ 'aria-current': 'page' }}
        >
          <Icon />
          <span>{t(labelKey)}</span>
        </Link>
      ))}
    </nav>
  );
}
