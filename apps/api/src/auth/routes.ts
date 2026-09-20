/**
 * `/api/auth`: Google sign-in (OIDC, code + PKCE, handled here), session
 * introspection and sign-out. Mounted before `authMiddleware`, so these are
 * the only `/api` routes besides `/api/health` that work without a session.
 */
import { generateCodeVerifier, generateState } from 'arctic';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, getSignedCookie, setCookie, setSignedCookie } from 'hono/cookie';
import { z } from 'zod';
import {
  deleteAccountInputSchema,
  testLoginInputSchema,
  type AuthMeResponse,
  type User,
} from '@bookguardian/shared';
import type { AppEnv } from '../app-env';
import { ApiHttpError } from '../errors';
import { validate } from '../validation';
import {
  AccountNotAllowedError,
  deleteAccount,
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

/** Where the SPA shows sign-in errors (`?error=<code>&redirect=<return_to>`). */
export const LOGIN_PATH = '/login';

/**
 * `GET /google` and its callback are browser navigations, not fetches: a JSON
 * envelope there would be shown raw. When the request accepts HTML, failures
 * land on the SPA's login screen instead, carrying the error code and the
 * page the person was trying to reach. Fetch clients (and the tests that
 * exercise the JSON contract) still get the envelope.
 */
function wantsHtml(c: Context<AppEnv>): boolean {
  return (c.req.header('accept') ?? '').includes('text/html');
}

export function loginErrorPath(code: string, returnTo: string): string {
  const params = new URLSearchParams({ error: code });
  if (returnTo !== '/') params.set('redirect', returnTo);
  return `${LOGIN_PATH}?${params.toString()}`;
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

  /** The session behind the cookie, or 401 (clearing a stale cookie on the way). */
  async function requireSession(c: Context<AppEnv>) {
    const token = getCookie(c, SESSION_COOKIE);
    const valid = token ? await sessions.validate(token) : null;
    if (!valid || !token) {
      if (token) deleteCookie(c, SESSION_COOKIE, { path: '/' });
      throw new ApiHttpError(401, 'unauthenticated', 'Not signed in');
    }
    return { user: valid.user, renewed: valid.renewed, token };
  }

  function requireOidc(): OidcClient {
    if (oidc) return oidc;
    log('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set: Google sign-in is unavailable');
    throw new ApiHttpError(503, 'auth_not_configured', 'Google sign-in is not configured');
  }

  /** Browser navigation → login screen with the code; anything else → JSON envelope. */
  function failNavigation(c: Context<AppEnv>, error: unknown, returnTo: string): Response {
    const failure = oidcFailure(error);
    if (!wantsHtml(c)) throw failure;
    if (!(failure instanceof ApiHttpError)) {
      console.error('[auth] sign-in failed', failure);
      return c.redirect(loginErrorPath('internal_error', returnTo), 302);
    }
    return c.redirect(loginErrorPath(failure.code, returnTo), 302);
  }

  const routes = new Hono<AppEnv>()
    .get('/google', validate('query', startQuerySchema), async (c) => {
      const returnTo = safeReturnTo(c.req.valid('query').return_to);
      try {
        const client = requireOidc();
        const pending: PendingAuth = {
          state: generateState(),
          codeVerifier: generateCodeVerifier(),
          nonce: generateState(),
          returnTo,
        };
        const url = await client.createAuthorizationUrl(pending);
        await setSignedCookie(c, OAUTH_COOKIE, encodePending(pending), cookieSecret, oauthCookie);
        return c.redirect(url.toString(), 302);
      } catch (error) {
        return failNavigation(c, error, returnTo);
      }
    })

    .get('/google/callback', validate('query', callbackQuerySchema), async (c) => {
      const query = c.req.valid('query');
      const pending = decodePending(await getSignedCookie(c, cookieSecret, OAUTH_COOKIE));
      deleteCookie(c, OAUTH_COOKIE, { path: OAUTH_COOKIE_PATH });
      const returnTo = pending?.returnTo ?? '/';
      try {
        const client = requireOidc();
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
        const claims = await client.exchangeCode({
          code: query.code,
          codeVerifier: pending.codeVerifier,
          nonce: pending.nonce,
        });
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
        return c.redirect(returnTo, 302);
      } catch (error) {
        return failNavigation(c, error, returnTo);
      }
    })

    .get('/me', async (c) => {
      const { user, renewed, token } = await requireSession(c);
      if (renewed) setCookie(c, SESSION_COOKIE, token, sessionCookie());
      return c.json(present(user));
    })

    /**
     * Delete the signed-in account and everything it owns. The body must
     * repeat the account's email (typed by the user) — a confirmation the
     * SPA asks for in two steps, and a guard against a stray request.
     */
    .delete('/me', validate('json', deleteAccountInputSchema), async (c) => {
      const { user } = await requireSession(c);
      const { confirmEmail } = c.req.valid('json');
      if (!user.email || normalizeEmail(confirmEmail) !== user.email) {
        throw new ApiHttpError(
          422,
          'confirm_email_mismatch',
          'Type the email of this account to confirm',
        );
      }
      const { adapter, covers } = c.get('services');
      const deleted = await deleteAccount(adapter, user.id);
      if (deleted) await covers.removeOrphanFiles(deleted.privateCoverAssetIds);
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
      log(`deleted: ${user.email} (user ${user.id})`);
      return c.body(null, 204);
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
