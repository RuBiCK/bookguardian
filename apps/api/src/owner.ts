import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from './app-env';
import { seed } from './db/seed';

/** Pick the user a request acts as; `undefined` falls back to the local user. */
export type OwnerResolver = (c: Context<AppEnv>) => Promise<string | undefined>;

/**
 * Resolve the owner every query is scoped by.
 *
 * Single-user MVP: the owner is the one local user, created by the seed on
 * first contact. When accounts arrive this is the only place that changes —
 * routes already read `c.get('ownerId')` and repositories already filter by
 * it. Tests inject a `resolve` to act as a second user (private covers,
 * shared ISBNs); production has none.
 */
export function ownerMiddleware(resolve?: OwnerResolver): MiddlewareHandler<AppEnv> {
  let cached: string | undefined;
  return async (c, next) => {
    const chosen = resolve ? await resolve(c) : undefined;
    if (chosen) {
      c.set('ownerId', chosen);
      return next();
    }
    if (!cached) {
      const { adapter, repos } = c.get('services');
      const user = await repos.users.findFirst();
      cached = user ? user.id : (await seed(adapter)).userId;
    }
    c.set('ownerId', cached);
    await next();
  };
}
