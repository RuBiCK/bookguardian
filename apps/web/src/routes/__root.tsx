import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { Toaster } from '../components/Toaster';
import type { RouterContext } from '../router';

/**
 * Nothing but the outlet and the toaster: `/login` renders bare, everything
 * else lives under the `_app` layout (session guard + tab bar).
 */
function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}

export function NotFound() {
  const { t } = useTranslation();
  return (
    <Screen title={t('errors.notFound')}>
      <EmptyState title={t('errors.notFound')} illustration="search" />
    </Screen>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});
