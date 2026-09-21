import { onlineManager, QueryClient } from '@tanstack/react-query';
import { isUnauthenticated } from '../api/client';

/** How long persisted server state is kept for offline reads (see `persist.ts`). */
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        // Long enough to survive a week offline; the persister discards older data.
        gcTime: CACHE_MAX_AGE_MS,
        refetchOnWindowFocus: false,
        // Offline, a query with a saved copy shows it; one without tries the
        // network once and fails fast into the retry state instead of
        // sitting on a skeleton until the connection returns.
        networkMode: 'offlineFirst',
        // A 401 will not fix itself: fail fast so the shell can leave for /login.
        retry: (failureCount, error) =>
          !isUnauthenticated(error) && onlineManager.isOnline() && failureCount < 2,
      },
      mutations: {
        retry: false,
        // Read-only offline: a write attempted without a connection fails at
        // once and its optimistic change is rolled back, rather than queueing
        // silently and being lost when the app is closed.
        networkMode: 'always',
      },
    },
  });
}
