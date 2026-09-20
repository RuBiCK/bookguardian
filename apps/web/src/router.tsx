import type { QueryClient } from '@tanstack/react-query';
import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { Splash } from './components/Splash';
import { routeTree } from './routeTree.gen';

/** What every route's `beforeLoad` / `loader` can reach through `context`. */
export interface RouterContext {
  queryClient: QueryClient;
}

export function createAppRouter(context: RouterContext, history?: RouterHistory) {
  return createRouter({
    routeTree,
    context,
    history,
    defaultPreload: 'intent',
    scrollRestoration: true,
    // The session guard awaits `/api/auth/me` before the first screen renders:
    // show the app shell's splash meanwhile, never a flash of `/login`.
    defaultPendingComponent: Splash,
    defaultPendingMs: 150,
    defaultPendingMinMs: 250,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
