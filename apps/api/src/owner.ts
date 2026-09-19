import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './app-env';
import { seed } from './db/seed';

/**
 * Resolve the owner every query is scoped by.
 *
 * Single-user MVP: the owner is the one local user, created by the seed on
 * first contact. When accounts arrive this is the only place that changes —
 * routes already read `c.get('ownerId')` and repositories already filter by
 * it.
 */
export function ownerMiddleware(): MiddlewareHandler<AppEnv> {
  let cached: string | undefined;
  return async (c, next) => {
    if (!cached) {
      const { adapter, repos } = c.get('services');
      const user = await repos.users.findFirst();
      cached = user ? user.id : (await seed(adapter)).userId;
    }
    c.set('ownerId', cached);
    await next();
  };
}
