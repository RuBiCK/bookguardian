import { apiErrorSchema } from '@bookguardian/shared';
import type { ZodType } from 'zod';

/**
 * The SPA and the API share one origin (see docs/auth.md), so every request
 * is a relative `/api/...` URL and the session cookie travels on its own: no
 * `VITE_API_URL`, no CORS, no `credentials: 'include'`. In dev and preview
 * Vite proxies `/api` to the API server to keep that model.
 */
export const API_BASE_URL = '';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** True for the one failure that means "no session": never retried, always sent to /login. */
export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /**
   * What a `401` does besides rejecting. `redirect` (default) hands it to the
   * handler installed by the app shell, which drops the cached session and
   * navigates to `/login`; `ignore` is for the session probe itself.
   */
  onUnauthenticated?: 'redirect' | 'ignore';
}

type UnauthenticatedHandler = () => void;
let unauthenticatedHandler: UnauthenticatedHandler | undefined;

/** Installed once by the app shell; returns the uninstall function. */
export function setUnauthenticatedHandler(handler: UnauthenticatedHandler | undefined) {
  unauthenticatedHandler = handler;
  return () => {
    if (unauthenticatedHandler === handler) unauthenticatedHandler = undefined;
  };
}

/** Typed fetch: validates the JSON response against `schema` and normalises errors. */
export async function apiRequest<T>(
  path: string,
  schema: ZodType<T>,
  { body, headers, onUnauthenticated = 'redirect', ...init }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    if (response.status === 401 && onUnauthenticated === 'redirect') unauthenticatedHandler?.();
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiClientError(response.status, code, message, details);
    }
    throw new ApiClientError(response.status, 'http_error', response.statusText);
  }

  return schema.parse(json);
}
