import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ensureSession, useSession } from '../api/auth';
import { TabBar } from '../components/TabBar';

/**
 * Everything behind a session. `beforeLoad` resolves `/api/auth/me` (from
 * the cache after the first time) before any child renders; without a
 * session it redirects to `/login`, remembering where the person was going.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const session = await ensureSession(context.queryClient);
    if (!session) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's redirect is thrown by design
      throw redirect({
        to: '/login',
        search: location.href === '/' ? {} : { redirect: location.href },
        replace: true,
      });
    }
    return { session };
  },
  component: AppShell,
});

function AppShell() {
  const session = useSession();
  const router = useRouter();

  // The guard only runs on navigation. When the session query turns null
  // afterwards — a 401 from any request, a focus re-check that finds the
  // session expired — leave for /login from wherever we are.
  useEffect(() => {
    if (session.data !== null) return;
    const here = router.latestLocation.href;
    if (here.startsWith('/login')) return;
    void router.navigate({
      to: '/login',
      search: here === '/' ? {} : { redirect: here },
      replace: true,
    });
  }, [session.data, router]);

  return (
    <div className="app-shell">
      <main className="app-shell__main">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
