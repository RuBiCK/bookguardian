import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { AuthMeResponse } from '@bookguardian/shared';
import { dropSession, SESSION_KEY } from '../src/api/auth';
import { setUnauthenticatedHandler } from '../src/api/client';
import { createQueryClient } from '../src/lib/query-client';
import { createAppRouter } from '../src/router';

/** The account every screen test runs as unless told otherwise. */
export const TEST_USER: AuthMeResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Ana Lector',
  email: 'ana@example.com',
  avatarUrl: null,
};

export interface RenderAppOptions {
  /**
   * What `/api/auth/me` is known to be before the first render: a user
   * (default: `TEST_USER`), `null` for signed out, or `'fetch'` to leave the
   * cache empty so the guard really requests it (mock `fetch` first).
   */
  session?: AuthMeResponse | null | 'fetch';
}

/** Render the whole app shell at `path` with an in-memory history. */
export async function renderApp(path = '/', { session = TEST_USER }: RenderAppOptions = {}) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false, retryDelay: 0 },
  });
  if (session !== 'fetch') queryClient.setQueryData(SESSION_KEY, session);
  const router = createAppRouter({ queryClient }, createMemoryHistory({ initialEntries: [path] }));
  // What `App` installs: a 401 anywhere drops the session, which sends the shell to /login.
  setUnauthenticatedHandler(() => dropSession(queryClient));
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await router.load();
  return { ...utils, router, queryClient };
}
