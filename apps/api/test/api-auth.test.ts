/**
 * `/api/auth` end to end against a fake Google (discovery, JWKS and token
 * endpoint answered by a stubbed `fetch`, real RS256 id_tokens) and the
 * session cookie in front of the rest of the API.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthMeResponse, LibraryListResponse } from '@bookguardian/shared';
import {
  createGoogleOidcClient,
  hashSessionToken,
  safeReturnTo,
  SESSION_COOKIE,
} from '../src/auth';
import { createTestApp, json, type ErrorBody, type TestApp } from './app';
import { fakeGoogle, parseSetCookies, type FakeGoogle } from './google-fixtures';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const CLIENT_SECRET = 'test-client-secret';
const BASE_URL = 'http://localhost:3000';
const REDIRECT_URI = `${BASE_URL}/api/auth/google/callback`;
const COOKIE_SECRET = 'a-cookie-secret-that-is-at-least-32-chars';
const DAY_MS = 86_400_000;

interface AuthTestOptions {
  baseUrl?: string;
  allowedEmails?: Set<string> | null;
  env?: 'development' | 'test' | 'production';
  configured?: boolean;
  now?: () => Date;
}

async function createAuthApp(google: FakeGoogle, options: AuthTestOptions = {}) {
  const baseUrl = options.baseUrl ?? BASE_URL;
  const oidc = createGoogleOidcClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: `${baseUrl}/api/auth/google/callback`,
    issuer: google.issuer,
    fetch: google.fetch,
    now: options.now,
  });
  return createTestApp({
    sessionAuth: true,
    auth: {
      env: options.env ?? 'test',
      baseUrl,
      cookieSecret: COOKIE_SECRET,
      oidc: options.configured === false ? undefined : oidc,
      account: { allowedEmails: options.allowedEmails ?? null, now: options.now },
      now: options.now,
      log: () => undefined,
    },
  });
}

/** Steps 1–2 of the flow: start at the API, consent at "Google". Returns what the callback needs. */
async function startSignIn(t: TestApp, google: FakeGoogle, returnTo?: string) {
  const path =
    returnTo === undefined
      ? '/api/auth/google'
      : `/api/auth/google?return_to=${encodeURIComponent(returnTo)}`;
  const res = await t.app.request(path);
  expect(res.status).toBe(302);
  const location = res.headers.get('location')!;
  const cookies = parseSetCookies(res);
  const oauth = cookies.bg_oauth!;
  const { code, state } = google.authorize(location);
  return { location, code, state, oauthCookie: `bg_oauth=${oauth.value}`, oauthAttrs: oauth.attrs };
}

/** The whole flow; returns the `Cookie` header of the new session. */
async function signIn(t: TestApp, google: FakeGoogle, returnTo?: string) {
  const { code, state, oauthCookie } = await startSignIn(t, google, returnTo);
  const res = await t.app.request(
    `/api/auth/google/callback?code=${code}&state=${encodeURIComponent(state)}`,
    { headers: { cookie: oauthCookie, 'user-agent': 'vitest/1.0' } },
  );
  expect(res.status).toBe(302);
  const cookies = parseSetCookies(res);
  const session = cookies[SESSION_COOKIE];
  expect(session).toBeDefined();
  return { res, cookie: `${SESSION_COOKIE}=${session!.value}`, token: session!.value, cookies };
}

describe('safeReturnTo', () => {
  it('accepts only relative SPA paths', () => {
    expect(safeReturnTo('/books/1?x=1#y')).toBe('/books/1?x=1#y');
    expect(safeReturnTo(undefined)).toBe('/');
    expect(safeReturnTo('')).toBe('/');
    expect(safeReturnTo('books')).toBe('/');
    expect(safeReturnTo('https://evil.test/')).toBe('/');
    expect(safeReturnTo('//evil.test/')).toBe('/');
    expect(safeReturnTo('/\\evil.test/')).toBe('/');
    expect(safeReturnTo('/ok\r\nSet-Cookie: x=1')).toBe('/');
    expect(safeReturnTo('/' + 'a'.repeat(3000))).toBe('/');
  });
});

describe('Google sign-in', () => {
  let google: FakeGoogle;
  let t: TestApp;

  beforeAll(async () => {
    google = await fakeGoogle({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
    });
    // `arctic` exchanges the code through the global fetch.
    vi.stubGlobal('fetch', google.fetch);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });
  beforeEach(async () => {
    google.tamper = {};
    google.user = {
      sub: 'google-sub-1',
      email: 'Ana.Lector@Example.com',
      email_verified: true,
      name: 'Ana Lector',
      picture: 'https://lh3.googleusercontent.com/ana.png',
    };
    t = await createAuthApp(google);
  });
  afterEach(async () => {
    await t.cleanup();
  });

  it('redirects to Google with PKCE, state and nonce, keeping them in a signed short-lived cookie', async () => {
    const { location, oauthAttrs } = await startSignIn(t, google, '/books/42');
    const url = new URL(location);
    expect(url.origin + url.pathname).toBe(`${google.issuer}/authorize`);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('nonce')).toBeTruthy();
    expect(oauthAttrs).toMatchObject({
      httponly: true,
      samesite: 'Lax',
      path: '/api/auth',
      'max-age': '600',
    });
    expect(oauthAttrs.secure).toBeUndefined();
  });

  it('signs in: sets the session cookie, redirects to return_to, /me and the API work', async () => {
    const { res, cookie, cookies } = await signIn(t, google, '/books/42');
    expect(res.headers.get('location')).toBe('/books/42');
    const session = cookies[SESSION_COOKIE]!;
    expect(session.attrs).toMatchObject({
      httponly: true,
      samesite: 'Lax',
      path: '/',
      'max-age': String(30 * 24 * 3600),
    });
    expect(session.attrs.secure).toBeUndefined();
    // The in-flight cookie is gone.
    expect(cookies.bg_oauth?.attrs['max-age']).toBe('0');

    const me = await t.app.request('/api/auth/me', { headers: { cookie } });
    expect(me.status).toBe(200);
    expect((await me.json()) as AuthMeResponse).toEqual({
      id: expect.any(String) as string,
      displayName: 'Ana Lector',
      email: 'ana.lector@example.com',
      avatarUrl: 'https://lh3.googleusercontent.com/ana.png',
    });

    const libraries = await t.app.request('/api/libraries', { headers: { cookie } });
    expect(libraries.status).toBe(200);

    // Only the hash is stored, with the user agent.
    const stored = await t.repos.sessions.findByTokenHash(hashSessionToken(session.value));
    expect(stored).toMatchObject({ userAgent: 'vitest/1.0' });
    expect(JSON.stringify(await t.repos.sessions.listByUser(stored!.userId))).not.toContain(
      session.value,
    );
  });

  it('the first sign-in claims the local user and its library', async () => {
    const { cookie } = await signIn(t, google);
    const me = (await json<AuthMeResponse>(t.app, 'GET', '/api/auth/me', undefined, cookie)).body;
    expect(me.id).toBe(t.base.userId);
    const libraries = await t.app.request('/api/libraries', { headers: { cookie } });
    const body = (await libraries.json()) as LibraryListResponse;
    expect(body.items.map((l) => l.name)).toEqual(['My Library']);
  });

  it('falls back to / for an unsafe return_to', async () => {
    const { res } = await signIn(t, google, 'https://evil.test/phish');
    expect(res.headers.get('location')).toBe('/');
  });

  it('marks cookies Secure when the public origin is https', async () => {
    const httpsGoogle = await fakeGoogle({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: 'https://books.example.com/api/auth/google/callback',
    });
    const secureApp = await createAuthApp(httpsGoogle, { baseUrl: 'https://books.example.com' });
    vi.stubGlobal('fetch', httpsGoogle.fetch);
    try {
      const { oauthAttrs } = await startSignIn(secureApp, httpsGoogle);
      expect(oauthAttrs.secure).toBe(true);
      const { cookies } = await signIn(secureApp, httpsGoogle);
      expect(cookies[SESSION_COOKIE]!.attrs.secure).toBe(true);
    } finally {
      vi.stubGlobal('fetch', google.fetch);
      await secureApp.cleanup();
    }
  });

  it('caches discovery and the key set across sign-ins', async () => {
    const before = { ...google.calls };
    await signIn(t, google);
    await signIn(t, google);
    expect(google.calls.discovery - before.discovery).toBe(1);
    expect(google.calls.jwks - before.jwks).toBe(1);
    expect(google.calls.token - before.token).toBe(2);
  });

  it('answers 400 invalid_state when the state does not match or the cookie is missing', async () => {
    const { code, state, oauthCookie } = await startSignIn(t, google);
    const wrong = await json<ErrorBody>(
      t.app,
      'GET',
      `/api/auth/google/callback?code=${code}&state=nope`,
      undefined,
      oauthCookie,
    );
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('invalid_state');

    const noCookie = await json<ErrorBody>(
      t.app,
      'GET',
      `/api/auth/google/callback?code=${code}&state=${encodeURIComponent(state)}`,
    );
    expect(noCookie.status).toBe(400);
    expect(noCookie.body.error.code).toBe('invalid_state');

    const forged = await json<ErrorBody>(
      t.app,
      'GET',
      `/api/auth/google/callback?code=${code}&state=${encodeURIComponent(state)}`,
      undefined,
      `${oauthCookie}x`,
    );
    expect(forged.status).toBe(400);
    expect(forged.body.error.code).toBe('invalid_state');
    expect(await t.repos.sessions.listByUser(t.base.userId)).toHaveLength(0);
  });

  it('answers 400 oauth_error when Google denies the request', async () => {
    const { state, oauthCookie } = await startSignIn(t, google);
    const res = await json<ErrorBody>(
      t.app,
      'GET',
      `/api/auth/google/callback?error=access_denied&state=${encodeURIComponent(state)}`,
      undefined,
      oauthCookie,
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('oauth_error');
  });

  it('answers 403 email_not_verified and creates nothing', async () => {
    google.user.email_verified = false;
    const { code, state, oauthCookie } = await startSignIn(t, google);
    const res = await json<ErrorBody>(
      t.app,
      'GET',
      `/api/auth/google/callback?code=${code}&state=${encodeURIComponent(state)}`,
      undefined,
      oauthCookie,
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('email_not_verified');
    expect(await t.repos.authIdentities.count()).toBe(0);
    expect(await t.repos.sessions.listByUser(t.base.userId)).toHaveLength(0);
  });

  it('answers 403 not_allowed for an email outside AUTH_ALLOWED_EMAILS', async () => {
    await t.cleanup();
    t = await createAuthApp(google, { allowedEmails: new Set(['someone.else@example.com']) });
    const { code, state, oauthCookie } = await startSignIn(t, google);
    const res = await json<ErrorBody>(
      t.app,
      'GET',
      `/api/auth/google/callback?code=${code}&state=${encodeURIComponent(state)}`,
      undefined,
      oauthCookie,
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('not_allowed');
    expect(await t.repos.authIdentities.count()).toBe(0);
  });

  it.each([
    ['a bad signature', { wrongKey: true }],
    ['another audience', { audience: 'someone-else' }],
    ['another issuer', { issuer: 'https://not-google.test' }],
    ['a nonce mismatch', { nonce: 'stale' }],
    ['a missing nonce', { nonce: null }],
    ['an expired token', { expired: true }],
  ] as const)('rejects an id_token with %s', async (_label, tamper) => {
    google.tamper = { ...tamper };
    const { code, state, oauthCookie } = await startSignIn(t, google);
    const res = await json<ErrorBody>(
      t.app,
      'GET',
      `/api/auth/google/callback?code=${code}&state=${encodeURIComponent(state)}`,
      undefined,
      oauthCookie,
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('oauth_error');
    expect(await t.repos.authIdentities.count()).toBe(0);
  });

  it('answers 400 oauth_error when the code exchange fails', async () => {
    const { state, oauthCookie } = await startSignIn(t, google);
    const res = await json<ErrorBody>(
      t.app,
      'GET',
      `/api/auth/google/callback?code=never-issued&state=${encodeURIComponent(state)}`,
      undefined,
      oauthCookie,
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('oauth_error');
  });

  it('answers 503 oauth_error when Google cannot be reached', async () => {
    // Discovery down: the start of the flow fails.
    const offline = await createTestApp({
      sessionAuth: true,
      auth: {
        env: 'test',
        cookieSecret: COOKIE_SECRET,
        oidc: createGoogleOidcClient({
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          redirectUri: REDIRECT_URI,
          issuer: google.issuer,
          fetch: () => Promise.reject(new Error('ECONNREFUSED')),
        }),
        log: () => undefined,
      },
    });
    try {
      const start = await json<ErrorBody>(offline.app, 'GET', '/api/auth/google');
      expect(start.status).toBe(503);
      expect(start.body.error.code).toBe('oauth_error');
    } finally {
      await offline.cleanup();
    }

    // Token endpoint down after a successful redirect.
    const { code, state, oauthCookie } = await startSignIn(t, google);
    vi.stubGlobal('fetch', () => Promise.reject(new Error('ECONNREFUSED')));
    try {
      const res = await json<ErrorBody>(
        t.app,
        'GET',
        `/api/auth/google/callback?code=${code}&state=${encodeURIComponent(state)}`,
        undefined,
        oauthCookie,
      );
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('oauth_error');
    } finally {
      vi.stubGlobal('fetch', google.fetch);
    }
  });

  it('answers 503 auth_not_configured without Google credentials', async () => {
    await t.cleanup();
    t = await createAuthApp(google, { configured: false });
    const start = await json<ErrorBody>(t.app, 'GET', '/api/auth/google');
    expect(start.status).toBe(503);
    expect(start.body.error.code).toBe('auth_not_configured');
    const callback = await json<ErrorBody>(
      t.app,
      'GET',
      '/api/auth/google/callback?code=x&state=y',
    );
    expect(callback.status).toBe(503);
    // Health still answers.
    expect((await t.app.request('/api/health?shallow=true')).status).toBe(200);
  });
});

describe('sessions', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await createTestApp({ sessionAuth: true, auth: { log: () => undefined } });
  });
  afterEach(async () => {
    await t.cleanup();
  });

  it('protects every /api route but health and auth; unknown paths stay 404', async () => {
    for (const path of [
      '/api/libraries',
      '/api/books',
      '/api/defaults',
      '/api/lendings',
      '/api/covers/backfill',
    ]) {
      const res = await json<ErrorBody>(t.app, 'GET', path);
      expect(res.status, path).toBe(401);
      expect(res.body.error.code).toBe('unauthenticated');
    }
    expect((await t.app.request('/api/health')).status).toBe(200);
    expect((await json<ErrorBody>(t.app, 'GET', '/api/auth/me')).status).toBe(401);
    expect((await json<ErrorBody>(t.app, 'GET', '/api/nope')).status).toBe(404);
    expect((await t.app.request('/api/auth/logout', { method: 'POST' })).status).toBe(204);
  });

  it('keeps unknown /api paths 404 when the SPA shell is served from the same process', async () => {
    // With WEB_DIST the app also has `GET /*` handlers for the SPA; they must
    // not make `/api/nope` look like a protected route (CI's Docker smoke test).
    const dist = mkdtempSync(join(tmpdir(), 'bookguardian-dist-'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
    const served = await createTestApp({
      sessionAuth: true,
      webDist: dist,
      auth: { log: () => undefined },
    });
    try {
      const nope = await json<ErrorBody>(served.app, 'GET', '/api/nope');
      expect(nope.status).toBe(404);
      expect(nope.body.error.code).toBe('not_found');
      expect((await json<ErrorBody>(served.app, 'GET', '/api/libraries')).status).toBe(401);
      const shell = await served.app.request('/books/deep-link');
      expect(shell.status).toBe(200);
      expect(await shell.text()).toContain('<div id="root">');
    } finally {
      await served.cleanup();
      rmSync(dist, { recursive: true, force: true });
    }
  });

  it('a garbage cookie is 401 and gets cleared', async () => {
    const res = await t.app.request('/api/libraries', {
      headers: { cookie: `${SESSION_COOKIE}=nope` },
    });
    expect(res.status).toBe(401);
    expect(parseSetCookies(res)[SESSION_COOKIE]?.attrs['max-age']).toBe('0');
  });

  it('loginAs gives a working session; logout invalidates it in the database', async () => {
    const { cookie, token } = await t.loginAs(t.base.userId);
    const me = await json<AuthMeResponse>(t.app, 'GET', '/api/auth/me', undefined, cookie);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(t.base.userId);
    expect((await json(t.app, 'GET', '/api/libraries', undefined, cookie)).status).toBe(200);

    const logout = await t.app.request('/api/auth/logout', { method: 'POST', headers: { cookie } });
    expect(logout.status).toBe(204);
    expect(parseSetCookies(logout)[SESSION_COOKIE]?.attrs['max-age']).toBe('0');
    expect(await t.repos.sessions.findByTokenHash(hashSessionToken(token))).toBeNull();
    expect((await json(t.app, 'GET', '/api/auth/me', undefined, cookie)).status).toBe(401);
    expect((await json(t.app, 'GET', '/api/libraries', undefined, cookie)).status).toBe(401);
  });

  it('an expired session is 401, deleted, and the cookie cleared', async () => {
    const { cookie, token } = await t.loginAs(t.base.userId);
    const row = await t.repos.sessions.findByTokenHash(hashSessionToken(token));
    await t.repos.sessions.touch(row!.id, {
      lastSeenAt: row!.lastSeenAt,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const res = await t.app.request('/api/libraries', { headers: { cookie } });
    expect(res.status).toBe(401);
    expect(parseSetCookies(res)[SESSION_COOKIE]?.attrs['max-age']).toBe('0');
    expect(await t.repos.sessions.findByTokenHash(hashSessionToken(token))).toBeNull();
  });

  it('slides the expiry past the halfway point and re-issues the cookie', async () => {
    await t.cleanup();
    let clock = Date.parse('2026-09-20T10:00:00.000Z');
    const now = () => new Date(clock);
    t = await createTestApp({ sessionAuth: true, auth: { now, log: () => undefined } });
    const { cookie, token } = await t.loginAs(t.base.userId);
    const hash = hashSessionToken(token);
    const initial = (await t.repos.sessions.findByTokenHash(hash))!;
    expect(Date.parse(initial.expiresAt) - clock).toBe(30 * DAY_MS);

    // Day 10: still fresh, nothing re-issued.
    clock += 10 * DAY_MS;
    const early = await t.app.request('/api/libraries', { headers: { cookie } });
    expect(early.status).toBe(200);
    expect(parseSetCookies(early)[SESSION_COOKIE]).toBeUndefined();
    const seen = (await t.repos.sessions.findByTokenHash(hash))!;
    expect(seen.expiresAt).toBe(initial.expiresAt);
    expect(seen.lastSeenAt).toBe(now().toISOString());

    // Day 20: less than half the lifetime left → renewed for 30 more days.
    clock += 10 * DAY_MS;
    const late = await t.app.request('/api/libraries', { headers: { cookie } });
    expect(late.status).toBe(200);
    expect(parseSetCookies(late)[SESSION_COOKIE]).toMatchObject({
      value: token,
      attrs: { 'max-age': String(30 * 24 * 3600) },
    });
    const renewed = (await t.repos.sessions.findByTokenHash(hash))!;
    expect(Date.parse(renewed.expiresAt) - clock).toBe(30 * DAY_MS);
  });

  it('purges expired sessions', async () => {
    const { token: live } = await t.loginAs(t.base.userId);
    const { token: dead } = await t.loginAs(t.base.userId);
    const row = (await t.repos.sessions.findByTokenHash(hashSessionToken(dead)))!;
    await t.repos.sessions.touch(row.id, {
      lastSeenAt: row.lastSeenAt,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await t.repos.sessions.deleteExpired(new Date().toISOString())).toBe(1);
    expect(await t.repos.sessions.findByTokenHash(hashSessionToken(live))).not.toBeNull();
    expect(await t.repos.sessions.findByTokenHash(hashSessionToken(dead))).toBeNull();
  });
});

describe('POST /api/auth/test-login', () => {
  it('exists only under NODE_ENV=test', async () => {
    for (const env of ['development', 'production'] as const) {
      const t = await createTestApp({ sessionAuth: true, auth: { env, log: () => undefined } });
      try {
        const res = await json<ErrorBody>(t.app, 'POST', '/api/auth/test-login', {
          email: 'e2e@example.com',
        });
        expect(res.status, env).toBe(404);
        expect(res.body.error.code).toBe('not_found');
      } finally {
        await t.cleanup();
      }
    }
  });

  it('signs in as any email in test, through the same account resolution', async () => {
    const t = await createTestApp({
      sessionAuth: true,
      auth: { env: 'test', log: () => undefined },
    });
    try {
      const res = await t.app.request('/api/auth/test-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'E2E@Example.com', name: 'E2E Tester' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as AuthMeResponse;
      // First sign-in claims the seeded local user.
      expect(body).toMatchObject({
        id: t.base.userId,
        email: 'e2e@example.com',
        displayName: 'E2E Tester',
      });
      const cookie = `${SESSION_COOKIE}=${parseSetCookies(res)[SESSION_COOKIE]!.value}`;
      expect((await json(t.app, 'GET', '/api/libraries', undefined, cookie)).status).toBe(200);

      const invalid = await json<ErrorBody>(t.app, 'POST', '/api/auth/test-login', {
        email: 'nope',
      });
      expect(invalid.status).toBe(422);
    } finally {
      await t.cleanup();
    }
  });
});
