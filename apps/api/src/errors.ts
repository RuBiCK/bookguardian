import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import type { ApiError } from '@bookguardian/shared';
import { NotFoundError } from './db/repositories';

export class ApiHttpError extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 500 | 503,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(status, { message });
    this.name = 'ApiHttpError';
  }
}

function envelope(code: string, message: string, details?: unknown): ApiError {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

/** Map any thrown value to the shared `ApiError` envelope. */
export function onError(error: Error, c: Context) {
  if (error instanceof ApiHttpError) {
    return c.json(envelope(error.code, error.message, error.details), error.status);
  }
  if (error instanceof ZodError) {
    return c.json(envelope('validation_error', 'Request validation failed', error.issues), 422);
  }
  if (error instanceof NotFoundError) {
    return c.json(envelope('not_found', error.message), 404);
  }
  if (error instanceof HTTPException) {
    return c.json(envelope('http_error', error.message), error.status);
  }
  console.error('[api] unhandled error', error);
  return c.json(envelope('internal_error', 'Internal server error'), 500);
}

export function notFound(c: Context) {
  return c.json(envelope('not_found', `No route for ${c.req.method} ${c.req.path}`), 404);
}
