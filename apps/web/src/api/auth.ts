/**
 * The signed-in account: who `GET /api/auth/me` says we are, and the one
 * destructive thing an account can do to itself. Sign-in, the router guard
 * and sign-out live with the login screen (BOOK-14); this module only needs
 * enough of the session to show and delete the account from Settings.
 */
import { authMeResponseSchema, type DeleteAccountInput } from '@bookguardian/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from './client';

export const sessionKey = ['auth', 'me'] as const;

export const sessionQueryOptions = queryOptions({
  queryKey: sessionKey,
  queryFn: () => apiRequest('/api/auth/me', authMeResponseSchema),
  staleTime: 5 * 60_000,
  retry: false,
});

export function useSession() {
  return useQuery(sessionQueryOptions);
}

interface Callbacks {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * `DELETE /api/auth/me` with the typed-back email. On success every cached
 * query is dropped: nothing the account owned may linger on screen.
 */
export function useDeleteAccount(callbacks: Callbacks = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteAccountInput) =>
      apiRequest('/api/auth/me', z.undefined(), { method: 'DELETE', body: input }),
    onSuccess: () => {
      client.clear();
      callbacks.onSuccess?.();
    },
    onError: (error) => callbacks.onError?.(error),
  });
}
