import { apiErrorSchema } from '@bookguardian/shared';
import type { ZodType } from 'zod';

/**
 * Base URL of the API. In dev and preview Vite proxies `/api` to the API
 * server, so a relative URL works everywhere; set VITE_API_URL to point the
 * built SPA at a remote API.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

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

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/** Typed fetch: validates the JSON response against `schema` and normalises errors. */
export async function apiRequest<T>(
  path: string,
  schema: ZodType<T>,
  { body, headers, ...init }: RequestOptions = {},
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
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiClientError(response.status, code, message, details);
    }
    throw new ApiClientError(response.status, 'http_error', response.statusText);
  }

  return schema.parse(json);
}
