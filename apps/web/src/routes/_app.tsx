import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ensureSession, useSession } from '../api/auth';
import { OfflineBanner } from '../components/OfflineBanner';
import { PullToRefresh } from '../components/PullToRefresh';
import { TabBar } from '../components/TabBar';

/**
 * Paths under this layout that a visitor without a session may see: `/` is
 * the public landing page (BOOK-18), which renders bare — no guard, no shell.
 * Everything else needs a session.
 */
const PUBLIC_PATHS = new Set(['/']);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/**
 * Everything behind a session. `beforeLoad` resolves `/api/auth/me` (from
 * the cache after the first time) before any child renders; without a
 * session it redirects to `/login`, remembering where the person was going —
 * except on a public path, which renders as itself.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const session = await ensureSession(context.queryClient);
    if (!session && !isPublicPath(location.pathname)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's redirect is thrown by design
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
        replace: true,
      });
    }
    return { session };
  },
  component: AppShell,
});

function AppShell() {
  const { t } = useTranslation();
  const session = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mainRef = useRef<HTMLElement>(null);

  // The guard only runs on navigation. When the session query turns null
  // afterwards — a 401 from any request, a focus re-check that finds the
  // session expired — leave for /login from wherever we are. A public path
  // is at home without a session and stays put.
  useEffect(() => {
    if (session.data !== null) return;
    const here = router.latestLocation.href;
    if (here.startsWith('/login') || isPublicPath(router.latestLocation.pathname)) return;
    void router.navigate({ to: '/login', search: { redirect: here }, replace: true });
  }, [session.data, router]);

  const refresh = useCallback(() => queryClient.refetchQueries({ type: 'active' }), [queryClient]);

  // No session: the guard let us through, so this is a public path. It owns
  // the whole viewport — no tab bar, no pull-to-refresh, no app chrome.
  if (session.data === null) return <Outlet />;

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        {t('a11y.skipToContent')}
      </a>
      <PullToRefresh onRefresh={refresh} contentRef={mainRef} />
      <main id="main" ref={mainRef} className="app-shell__main" tabIndex={-1}>
        <OfflineBanner />
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
