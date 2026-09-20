import { QueryClient } from '@tanstack/react-query';
import { isUnauthenticated } from '../api/client';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
        // A 401 will not fix itself: fail fast so the shell can leave for /login.
        retry: (failureCount, error) => !isUnauthenticated(error) && failureCount < 2,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
