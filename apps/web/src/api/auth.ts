/**
 * The signed-in user, as one TanStack Query (`GET /api/auth/me`).
 *
 * `null` means "no session" and is a valid cached value: the route guard
 * reads it without a request, and the app shell watches it to leave for
 * `/login` the moment it turns null (a 401 anywhere, a sign-out, a session
 * that expired while the tab was in the background).
 */
import {
  authMeResponseSchema,
  type AuthMeResponse,
  type DeleteAccountInput,
} from '@bookguardian/shared';
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest, isUnauthenticated } from './client';

export type Session = AuthMeResponse | null;

export const SESSION_KEY = ['session'] as const;
/** Where the API's Google flow starts; it redirects back to `return_to` afterwards. */
export const GOOGLE_SIGN_IN_PATH = '/api/auth/google';

export async function fetchSession(): Promise<Session> {
  try {
    return await apiRequest('/api/auth/me', authMeResponseSchema, { onUnauthenticated: 'ignore' });
  } catch (error) {
    if (isUnauthenticated(error)) return null;
    throw error;
  }
}

export const sessionQueryOptions = queryOptions({
  queryKey: SESSION_KEY,
  queryFn: fetchSession,
  // A session lasts days; re-check it when the person comes back to the app.
  staleTime: 15 * 60_000,
  gcTime: Infinity,
  refetchOnWindowFocus: 'always',
  refetchOnReconnect: 'always',
  retry: 1,
});

export function useSession() {
  return useQuery(sessionQueryOptions);
}

/** Read (or fetch once) the session outside React: the router's `beforeLoad`. */
export function ensureSession(queryClient: QueryClient): Promise<Session> {
  return queryClient.ensureQueryData(sessionQueryOptions);
}

/** Forget the session locally (a 401 was seen); the guard will send us to /login. */
export function dropSession(queryClient: QueryClient) {
  queryClient.setQueryData(SESSION_KEY, null);
}

/**
 * The URL the "Continue with Google" button navigates to. The API redirects
 * back to `returnTo` once the callback has set the session cookie; only
 * relative SPA paths are honoured there, everything else lands on `/`.
 */
export function googleSignInUrl(returnTo?: string): string {
  if (!returnTo || returnTo === '/') return GOOGLE_SIGN_IN_PATH;
  return `${GOOGLE_SIGN_IN_PATH}?return_to=${encodeURIComponent(returnTo)}`;
}

/** Only relative SPA paths are safe to go back to (mirrors the API's `safeReturnTo`). */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return undefined;
  if (!/^\/(?![/\\])/.test(value)) return undefined;
  if (value.startsWith('/login')) return undefined;
  return value;
}

const noContent = z.undefined().or(z.null());

export function useLogout(options: { onSuccess?: () => void; onError?: () => void } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest('/api/auth/logout', noContent, { method: 'POST', onUnauthenticated: 'ignore' }),
    onSuccess: async () => {
      // Nothing of the previous account may survive in memory.
      await queryClient.cancelQueries();
      queryClient.clear();
      dropSession(queryClient);
      options.onSuccess?.();
    },
    onError: () => options.onError?.(),
  });
}

/**
 * `DELETE /api/auth/me` with the typed-back email (Settings → Account). On
 * success the cache is emptied and the session dropped, exactly like a
 * sign-out: nothing the account owned may linger on screen, and the guard
 * sends us to `/login`.
 */
export function useDeleteAccount(options: { onSuccess?: () => void; onError?: () => void } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteAccountInput) =>
      apiRequest('/api/auth/me', noContent, { method: 'DELETE', body: input }),
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      dropSession(queryClient);
      options.onSuccess?.();
    },
    onError: () => options.onError?.(),
  });
}
