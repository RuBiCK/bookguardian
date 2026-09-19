import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { TabBar } from '../components/TabBar';

function RootLayout() {
  return (
    <div className="app-shell">
      <main className="app-shell__main">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <Screen title={t('errors.notFound')}>
      <EmptyState title={t('errors.notFound')} action={<span />} />
    </Screen>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});
