import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { TABS } from './tabs';

/** Nested inventory screens (libraries, shelves, books) belong to the Library tab. */
const LIBRARY_PREFIXES = ['/libraries', '/shelves', '/books'];

export function TabBar() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) =>
    to === '/'
      ? pathname === '/' || LIBRARY_PREFIXES.some((p) => pathname.startsWith(p))
      : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <nav className="tabbar" aria-label={t('app.name')} data-testid="tabbar">
      {TABS.map(({ to, labelKey, Icon }) => (
        <Link
          key={to}
          to={to}
          className="tabbar__item"
          aria-current={isActive(to) ? 'page' : undefined}
        >
          <Icon />
          <span>{t(labelKey)}</span>
        </Link>
      ))}
    </nav>
  );
}
