import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { dropSession } from './api/auth';
import { setUnauthenticatedHandler } from './api/client';
import { createQueryClient } from './lib/query-client';
import { createAppRouter } from './router';

export function App() {
  const [queryClient] = useState(createQueryClient);
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
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
