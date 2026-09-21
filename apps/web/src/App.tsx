import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { dropSession, useSession } from './api/auth';
import { setUnauthenticatedHandler } from './api/client';
import { createQueryClient } from './lib/query-client';
import { createAppRouter } from './router';

interface AppProps {
  /** The (possibly restored-from-disk) client; created fresh when omitted. */
  queryClient?: QueryClient;
}

export function App({ queryClient: provided }: AppProps) {
  const [queryClient] = useState(() => provided ?? createQueryClient());
  const [router] = useState(() => createAppRouter({ queryClient }));

  // Any 401 from the API means the session is gone: forget it (the app shell
  // then leaves for /login) and stop whatever was in flight for that account.
  useEffect(
    () =>
      setUnauthenticatedHandler(() => {
        dropSession(queryClient);
        void queryClient.cancelQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
      }),
    [queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AccountBoundary queryClient={queryClient} />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

/**
 * The cache is persisted across launches; when a different account signs in
 * on the same device, nothing of the previous one may be served from it.
 */
function AccountBoundary({ queryClient }: { queryClient: QueryClient }) {
  const session = useSession();
  const userId = session.data?.id ?? null;
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (userId === null) return; // signed out: sign-out already emptied the cache
    if (seen.current !== null && seen.current !== userId) {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
    }
    seen.current = userId;
  }, [userId, queryClient]);
  return null;
}
