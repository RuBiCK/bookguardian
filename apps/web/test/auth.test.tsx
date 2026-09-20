/**
 * Sign-in screen, the session guard, what a 401 does anywhere, and sign-out.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { en } from '@bookguardian/shared/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { googleSignInUrl, safeRedirect, SESSION_KEY } from '../src/api/auth';
import { ApiClientError } from '../src/api/client';
import { createQueryClient } from '../src/lib/query-client';
import { installFakeApi, seedFakeApi, type FakeApi } from './fake-api';
import { renderApp, TEST_USER } from './render';

describe('login screen', () => {
  it('renders bare (no tab bar) with the Google button pointing at the API flow', async () => {
    const { router } = await renderApp('/login', { session: null });
    expect(await screen.findByTestId('login')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: en.app.name })).toBeInTheDocument();
    expect(screen.getByText(en.auth.tagline)).toBeInTheDocument();
    expect(screen.queryByTestId('tabbar')).not.toBeInTheDocument();

    const button = screen.getByRole('link', { name: en.auth.google });
    expect(button).toHaveAttribute('href', '/api/auth/google');
    expect(button.querySelector('svg')).not.toBeNull();
    expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('carries the page the person wanted as return_to', async () => {
    await renderApp('/login?redirect=%2Fshelves%2Fabc%3Fview%3Dbooks', { session: null });
    expect(await screen.findByRole('link', { name: en.auth.google })).toHaveAttribute(
      'href',
      '/api/auth/google?return_to=%2Fshelves%2Fabc%3Fview%3Dbooks',
    );
  });

  it('ignores an unsafe redirect (absolute URL, protocol-relative, /login itself)', async () => {
    for (const bad of ['https://evil.test/', '//evil.test', '/login?error=x', 'shelves']) {
      const { unmount } = await renderApp(`/login?redirect=${encodeURIComponent(bad)}`, {
        session: null,
      });
      expect(await screen.findByRole('link', { name: en.auth.google })).toHaveAttribute(
        'href',
        '/api/auth/google',
      );
      unmount();
    }
  });

  it.each([
    ['not_allowed', en.auth.error.not_allowed],
    ['email_not_verified', en.auth.error.email_not_verified],
    ['auth_not_configured', en.auth.error.auth_not_configured],
    ['oauth_error', en.auth.error.generic],
    ['invalid_state', en.auth.error.generic],
    ['something-new', en.auth.error.generic],
  ])('explains ?error=%s and keeps the button as the retry', async (code, message) => {
    await renderApp(`/login?error=${code}&redirect=%2Flending`, { session: null });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(en.auth.error.title);
    expect(alert).toHaveTextContent(message);
    expect(screen.getByRole('link', { name: en.auth.google })).toHaveAttribute(
      'href',
      '/api/auth/google?return_to=%2Flending',
    );
  });

  it('sends a signed-in visitor to where they were going (or home)', async () => {
    const { router } = await renderApp('/login?redirect=%2Fstats');
    expect(
      await screen.findByRole('heading', { level: 1, name: en.stats.title }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/stats');

    const home = await renderApp('/login');
    expect(
      await screen.findByRole('heading', { level: 1, name: en.library.title }),
    ).toBeInTheDocument();
    expect(home.router.state.location.pathname).toBe('/');
  });
});

describe('session guard', () => {
  let api: FakeApi;
  beforeEach(() => {
    api = installFakeApi();
    seedFakeApi(api);
  });
  afterEach(() => {
    api.restore();
  });

  it('redirects to /login without a session, remembering the destination', async () => {
    const { router } = await renderApp('/settings', { session: null });
    expect(await screen.findByTestId('login')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ redirect: '/settings' });
    expect(screen.queryByTestId('tabbar')).not.toBeInTheDocument();
  });

  it('asks /api/auth/me once on launch and renders the screen when signed in', async () => {
    const { router, queryClient } = await renderApp('/stats', { session: 'fetch' });
    expect(
      await screen.findByRole('heading', { level: 1, name: en.stats.title }),
    ).toBeInTheDocument();
    expect(api.calls.filter((c) => c.path === '/api/auth/me')).toHaveLength(1);
    expect(queryClient.getQueryData(SESSION_KEY)).toMatchObject({ email: 'ana@example.com' });

    // Moving between screens does not ask again.
    await router.navigate({ to: '/lending' });
    expect(
      await screen.findByRole('heading', { level: 1, name: en.lending.title }),
    ).toBeInTheDocument();
    expect(api.calls.filter((c) => c.path === '/api/auth/me')).toHaveLength(1);
  });

  it('shows the splash while the session is being checked, never the login screen', async () => {
    const original = globalThis.fetch;
    const slow = vi.fn(async (...args: Parameters<typeof fetch>) => {
      await new Promise((r) => setTimeout(r, 400));
      return original(...args);
    });
    globalThis.fetch = slow;
    try {
      const rendering = renderApp('/', { session: 'fetch' });
      expect(await screen.findByTestId('splash')).toBeInTheDocument();
      expect(screen.queryByTestId('login')).not.toBeInTheDocument();
      await rendering;
      expect(
        await screen.findByRole('heading', { level: 1, name: en.library.title }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId('splash')).not.toBeInTheDocument();
    } finally {
      globalThis.fetch = original;
    }
  });

  it('a 401 from any request drops the session and leaves for /login', async () => {
    const { router, queryClient } = await renderApp('/lending');
    expect(
      await screen.findByRole('heading', { level: 1, name: en.lending.title }),
    ).toBeInTheDocument();

    // The session expired server-side; the next request the screen makes is a 401.
    api.user = null;
    await queryClient.refetchQueries({ queryKey: ['lendings'] });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ redirect: '/lending' });
    expect(await screen.findByTestId('login')).toBeInTheDocument();
    expect(queryClient.getQueryData(SESSION_KEY)).toBeNull();
  });
});

describe('sign-out', () => {
  let api: FakeApi;
  beforeEach(() => {
    api = installFakeApi();
    seedFakeApi(api);
  });
  afterEach(() => {
    api.restore();
  });

  it('shows the account in settings: initial, name and email', async () => {
    await renderApp('/settings');
    const account = await screen.findByTestId('account');
    expect(account).toHaveTextContent(TEST_USER.displayName);
    expect(screen.getByTestId('account-email')).toHaveTextContent('ana@example.com');
    expect(screen.getByTestId('avatar-initial')).toHaveTextContent('A');
    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
  });

  it('shows the Google picture when there is one, falling back to the initial if it fails', async () => {
    const user = userEvent.setup();
    await renderApp('/settings', {
      session: { ...TEST_USER, avatarUrl: 'https://lh3.googleusercontent.com/ana.png' },
    });
    const image = await screen.findByTestId('avatar-image');
    expect(image).toHaveAttribute('src', 'https://lh3.googleusercontent.com/ana.png');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    // jsdom never loads images; a broken picture must not leave a hole.
    image.dispatchEvent(new Event('error'));
    expect(await screen.findByTestId('avatar-initial')).toHaveTextContent('A');
    expect(user).toBeDefined();
  });

  it('signs out: POST /api/auth/logout, cache emptied, back on /login', async () => {
    const user = userEvent.setup();
    const { router, queryClient } = await renderApp('/settings');
    await screen.findByTestId('account');
    // Warm some server state so we can see it go.
    await queryClient.prefetchQuery({ queryKey: ['libraries'], queryFn: () => ['x'] });
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(1);

    await user.click(screen.getByTestId('sign-out'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(api.calls.some((c) => c.method === 'POST' && c.path === '/api/auth/logout')).toBe(true);
    expect(await screen.findByTestId('login')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({});
    const remaining = queryClient
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey[0]);
    expect(remaining).toEqual(['session']);
    expect(queryClient.getQueryData(SESSION_KEY)).toBeNull();
  });

  it('keeps the account and says so when the logout request fails', async () => {
    const user = userEvent.setup();
    api.failNext({ method: 'POST', path: /\/api\/auth\/logout$/ }, 503);
    const { router } = await renderApp('/settings');
    await user.click(await screen.findByTestId('sign-out'));
    expect(await screen.findByText(en.settings.account.signOutFailed)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/settings');
    expect(screen.getByTestId('sign-out')).toBeEnabled();
  });
});

describe('helpers', () => {
  it('googleSignInUrl only adds return_to for a real destination', () => {
    expect(googleSignInUrl()).toBe('/api/auth/google');
    expect(googleSignInUrl('/')).toBe('/api/auth/google');
    expect(googleSignInUrl('/books/1?x=1')).toBe('/api/auth/google?return_to=%2Fbooks%2F1%3Fx%3D1');
  });

  it('safeRedirect accepts only relative SPA paths outside /login', () => {
    expect(safeRedirect('/books/1')).toBe('/books/1');
    expect(safeRedirect(undefined)).toBeUndefined();
    expect(safeRedirect('')).toBeUndefined();
    expect(safeRedirect('books')).toBeUndefined();
    expect(safeRedirect('//evil.test')).toBeUndefined();
    expect(safeRedirect('/\\evil.test')).toBeUndefined();
    expect(safeRedirect('https://evil.test/')).toBeUndefined();
    expect(safeRedirect('/login?redirect=%2F')).toBeUndefined();
    expect(safeRedirect('/' + 'a'.repeat(3000))).toBeUndefined();
  });

  it('never retries a 401, still retries other failures', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry;
    expect(typeof retry).toBe('function');
    const fn = retry as (count: number, error: unknown) => boolean;
    expect(fn(0, new ApiClientError(401, 'unauthenticated', 'no'))).toBe(false);
    expect(fn(0, new ApiClientError(503, 'down', 'no'))).toBe(true);
    expect(fn(1, new TypeError('Failed to fetch'))).toBe(true);
    expect(fn(2, new TypeError('Failed to fetch'))).toBe(false);
  });
});
