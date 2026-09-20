import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { matchedRoutes } from 'hono/route';
import type { AppEnv } from '../app-env';
import { ApiHttpError } from '../errors';
import { SESSION_COOKIE, sessionCookieOptions, type SessionService } from './session';

/** Test seam: pick the user a request acts as; `undefined` falls through to the session. */
export type OwnerResolver = (c: Context<AppEnv>) => Promise<string | undefined>;

export interface AuthMiddlewareOptions {
  sessions: SessionService;
  /** Cookie `Secure` flag (https deployments). */
  secureCookies: boolean;
  resolveOwner?: OwnerResolver;
}

/**
 * Every `/api/*` route past this point needs a signed-in user: the session
 * cookie is validated and `ownerId` (what repositories filter by) and `user`
 * are set on the context; anything else is `401 unauthenticated`.
 *
 * A path no route handles is left to `notFound` (404 rather than 401): the
 * only matches for it are `ALL`-method middlewares, so nothing is protected
 * and nothing about the API surface is hidden that the SPA does not know.
 *
 * Tests inject `resolveOwner` to act as a given user without a session
 * (`x-test-owner` in the API test harness); production never passes one.
 */
export function authMiddleware({
  sessions,
  secureCookies,
  resolveOwner,
}: AuthMiddlewareOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!matchedRoutes(c).some((route) => route.method !== 'ALL')) return next();
    const chosen = resolveOwner ? await resolveOwner(c) : undefined;
    if (chosen) {
      c.set('ownerId', chosen);
      return next();
    }
    const token = getCookie(c, SESSION_COOKIE);
    const valid = token ? await sessions.validate(token) : null;
    if (!valid) {
      if (token) deleteCookie(c, SESSION_COOKIE, { path: '/' });
      throw new ApiHttpError(401, 'unauthenticated', 'Sign in to continue');
    }
    if (valid.renewed && token) {
      setCookie(
        c,
        SESSION_COOKIE,
        token,
        sessionCookieOptions({
          secure: secureCookies,
          maxAgeSeconds: Math.floor(sessions.ttlMs / 1000),
        }),
      );
    }
    c.set('ownerId', valid.user.id);
    c.set('user', valid.user);
    await next();
  };
}
