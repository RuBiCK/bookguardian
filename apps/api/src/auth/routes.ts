/**
 * `/api/auth`: Google sign-in (OIDC, code + PKCE, handled here), session
 * introspection and sign-out. Mounted before `authMiddleware`, so these are
 * the only `/api` routes besides `/api/health` that work without a session.
 */
import { generateCodeVerifier, generateState } from 'arctic';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, getSignedCookie, setCookie, setSignedCookie } from 'hono/cookie';
import { z } from 'zod';
import { testLoginInputSchema, type AuthMeResponse, type User } from '@bookguardian/shared';
import type { AppEnv } from '../app-env';
import { ApiHttpError } from '../errors';
import { validate } from '../validation';
import {
  AccountNotAllowedError,
  EmailNotVerifiedError,
  normalizeEmail,
  resolveAccount,
  type ProviderProfile,
  type ResolveAccountOptions,
} from './account';
import { OidcError, type OidcClient } from './oidc';
import { SESSION_COOKIE, sessionCookieOptions, type SessionService } from './session';

/** Signed, short-lived cookie carrying the state of an in-flight authorization. */
export const OAUTH_COOKIE = 'bg_oauth';
const OAUTH_COOKIE_PATH = '/api/auth';
const OAUTH_COOKIE_MAX_AGE_S = 10 * 60;

export interface AuthRoutesOptions {
  env: 'development' | 'test' | 'production';
  sessions: SessionService;
  /** Secret the `bg_oauth` cookie is signed with (≥ 32 chars). */
  cookieSecret: string;
  secureCookies: boolean;
  /** `undefined` until `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are configured. */
  oidc?: OidcClient;
  account: ResolveAccountOptions;
  log?: (message: string) => void;
}

const startQuerySchema = z.object({ return_to: z.string().max(2048).optional() });

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

const pendingAuthSchema = z.object({
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
  nonce: z.string().min(1),
  returnTo: z.string(),
});
type PendingAuth = z.infer<typeof pendingAuthSchema>;

/**
 * Only a relative SPA path may be a post-login destination: it must start
 * with a single `/` (`//host` and `/\host` are protocol-relative) and carry
 * no control characters. Anything else lands on `/`.
 */
export function safeReturnTo(value: string | undefined): string {
  if (!value || value.length > 2048) return '/';
  if (!/^\/(?![/\\])/.test(value)) return '/';
  if ([...value].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)) return '/';
  return value;
}

function encodePending(pending: PendingAuth): string {
  return Buffer.from(JSON.stringify(pending)).toString('base64url');
}

function decodePending(raw: string | false | undefined): PendingAuth | undefined {
  if (!raw) return undefined;
  try {
    const parsed = pendingAuthSchema.safeParse(
      JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown,
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function present(user: User): AuthMeResponse {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };
}

function oidcFailure(error: unknown): Error {
  if (error instanceof OidcError) {
    return new ApiHttpError(error.status, 'oauth_error', error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}

export function createAuthRoutes(options: AuthRoutesOptions) {
  const { sessions, cookieSecret, secureCookies, oidc, account } = options;
  const log = options.log ?? ((message: string) => console.warn(`[auth] ${message}`));
  const sessionCookie = () =>
    sessionCookieOptions({
      secure: secureCookies,
      maxAgeSeconds: Math.floor(sessions.ttlMs / 1000),
    });
  const oauthCookie = {
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure: secureCookies,
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_COOKIE_MAX_AGE_S,
  };

  /** Resolve the account for a verified profile and start a session for it. */
  async function signIn(c: Context<AppEnv>, profile: ProviderProfile) {
    const { adapter } = c.get('services');
    try {
      const resolved = await resolveAccount(adapter, profile, account);
      const { token } = await sessions.create(resolved.user.id, c.req.header('user-agent'));
      setCookie(c, SESSION_COOKIE, token, sessionCookie());
      if (resolved.outcome !== 'existing') {
        log(`${resolved.outcome}: ${resolved.user.email} → user ${resolved.user.id}`);
      }
      return resolved;
    } catch (error) {
      if (error instanceof EmailNotVerifiedError) {
        throw new ApiHttpError(
          403,
          'email_not_verified',
          'Verify your email with the provider first',
        );
      }
      if (error instanceof AccountNotAllowedError) {
        throw new ApiHttpError(403, 'not_allowed', 'This email is not allowed to sign in');
      }
      throw error;
    }
  }

  function requireOidc(): OidcClient {
    if (oidc) return oidc;
    log('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set: Google sign-in is unavailable');
    throw new ApiHttpError(503, 'auth_not_configured', 'Google sign-in is not configured');
  }

  const routes = new Hono<AppEnv>()
    .get('/google', validate('query', startQuerySchema), async (c) => {
      const client = requireOidc();
      const pending: PendingAuth = {
        state: generateState(),
        codeVerifier: generateCodeVerifier(),
        nonce: generateState(),
        returnTo: safeReturnTo(c.req.valid('query').return_to),
      };
      let url: URL;
      try {
        url = await client.createAuthorizationUrl(pending);
      } catch (error) {
        throw oidcFailure(error);
      }
      await setSignedCookie(c, OAUTH_COOKIE, encodePending(pending), cookieSecret, oauthCookie);
      return c.redirect(url.toString(), 302);
    })

    .get('/google/callback', validate('query', callbackQuerySchema), async (c) => {
      const client = requireOidc();
      const query = c.req.valid('query');
      const pending = decodePending(await getSignedCookie(c, cookieSecret, OAUTH_COOKIE));
      deleteCookie(c, OAUTH_COOKIE, { path: OAUTH_COOKIE_PATH });
      if (!pending || !query.state || query.state !== pending.state) {
        throw new ApiHttpError(
          400,
          'invalid_state',
          'Sign-in request expired or was tampered with',
        );
      }
      if (query.error || !query.code) {
        const reason = query.error_description ?? query.error ?? 'no authorization code';
        throw new ApiHttpError(
          400,
          'oauth_error',
          `Google did not authorize the sign-in: ${reason}`,
        );
      }
      let claims;
      try {
        claims = await client.exchangeCode({
          code: query.code,
          codeVerifier: pending.codeVerifier,
          nonce: pending.nonce,
        });
      } catch (error) {
        throw oidcFailure(error);
      }
      if (!claims.emailVerified) {
        throw new ApiHttpError(403, 'email_not_verified', 'Verify your email with Google first');
      }
      await signIn(c, {
        provider: 'google',
        subject: claims.subject,
        email: claims.email,
        emailVerified: true,
        name: claims.name,
        picture: claims.picture,
      });
      return c.redirect(pending.returnTo, 302);
    })

    .get('/me', async (c) => {
      const token = getCookie(c, SESSION_COOKIE);
      const valid = token ? await sessions.validate(token) : null;
      if (!valid) {
        if (token) deleteCookie(c, SESSION_COOKIE, { path: '/' });
        throw new ApiHttpError(401, 'unauthenticated', 'Not signed in');
      }
      if (valid.renewed && token) setCookie(c, SESSION_COOKIE, token, sessionCookie());
      return c.json(present(valid.user));
    })

    .post('/logout', async (c) => {
      const token = getCookie(c, SESSION_COOKIE);
      if (token) await sessions.revoke(token);
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
      return c.body(null, 204);
    });

  // Playwright seam: sign in as any email without Google. Only exists under
  // NODE_ENV=test; a test asserts it is a 404 elsewhere.
  if (options.env === 'test') {
    routes.post('/test-login', validate('json', testLoginInputSchema), async (c) => {
      const { email, name } = c.req.valid('json');
      const resolved = await signIn(c, {
        provider: 'test',
        subject: normalizeEmail(email),
        email,
        emailVerified: true,
        name: name ?? null,
      });
      return c.json(present(resolved.user));
    });
  }

  return routes;
}
