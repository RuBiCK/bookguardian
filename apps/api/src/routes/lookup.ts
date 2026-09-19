import { Hono } from 'hono';
import {
  lookupIsbnParamSchema,
  lookupSearchQuerySchema,
  type LookupSearchResponse,
} from '@bookguardian/shared';
import type { AppEnv } from '../app-env';
import { ApiHttpError } from '../errors';
import { LookupUnavailableError } from '../lookup';
import { validate } from '../validation';

/** Cache lookups on the client too: metadata rarely changes within a day. */
const CACHE_CONTROL = 'private, max-age=86400';

function unavailable(error: unknown): never {
  if (error instanceof LookupUnavailableError) {
    throw new ApiHttpError(503, 'lookup_unavailable', 'Book metadata providers are unreachable', {
      providers: error.causes.map((c) => ({ provider: c.provider, message: c.message })),
    });
  }
  throw error;
}

export const lookupRoutes = new Hono<AppEnv>()
  .get('/isbn/:isbn', validate('param', lookupIsbnParamSchema), async (c) => {
    const { lookup } = c.get('services');
    const { isbn } = c.req.valid('param');
    const draft = await lookup.byIsbn(isbn).catch(unavailable);
    if (!draft)
      throw new ApiHttpError(404, 'isbn_not_found', 'No book found for this ISBN', { isbn });
    c.header('Cache-Control', CACHE_CONTROL);
    return c.json(draft);
  })
  .get('/search', validate('query', lookupSearchQuerySchema), async (c) => {
    const { lookup } = c.get('services');
    const { q, limit } = c.req.valid('query');
    const items = await lookup.search(q, limit).catch(unavailable);
    const body: LookupSearchResponse = { items };
    c.header('Cache-Control', CACHE_CONTROL);
    return c.json(body);
  });
