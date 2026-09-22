/**
 * The public landing page at `/` (BOOK-18): what a logged-out visitor sees,
 * what they do not (the app shell, any API call of ours), and how a signed-in
 * visitor never sees it at all.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { en, es } from '@bookguardian/shared/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18next from '../src/i18n';
import { LANDING_FEATURES } from '../src/landing/features';
import { REPO_URL } from '../src/landing/Landing';
import { installFakeApi, seedFakeApi, type FakeApi } from './fake-api';
import { renderApp } from './render';

describe('landing page', () => {
  let api: FakeApi;
  beforeEach(() => {
    api = installFakeApi();
    seedFakeApi(api);
  });
  afterEach(async () => {
    api.restore();
    localStorage.removeItem('bookguardian.locale');
    await i18next.changeLanguage('en');
  });

  it('greets a visitor without a session: one h1, no app chrome', async () => {
    const { router } = await renderApp('/', { session: null });

    expect(await screen.findByTestId('landing')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(en.landing.hero.title);
    expect(screen.getByText(en.landing.hero.body)).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    // Nothing of the signed-in app: no tab bar, no add-book FAB, no library.
    expect(screen.queryByTestId('tabbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('library-list')).not.toBeInTheDocument();
  });

  it('renders every feature card from the i18n catalogue', async () => {
    await renderApp('/', { session: null });

    const list = await screen.findByTestId('landing-features');
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(LANDING_FEATURES.length);
    expect(LANDING_FEATURES).toHaveLength(10);

    for (const [index, { key }] of LANDING_FEATURES.entries()) {
      const copy = en.landing.features[key];
      const card = cards[index]!;
      expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent(copy.title);
      expect(card).toHaveTextContent(copy.body);
    }
  });

  it('sends the login CTA to /login with `/` as the place to come back to', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/', { session: null });

    const cta = await screen.findByTestId('landing-login');
    expect(cta).toHaveTextContent(en.landing.hero.cta);
    expect(cta).toHaveAttribute('href', '/login?redirect=%2F');

    // It is a real navigation, and /login takes it from there.
    await user.click(cta);
    expect(await screen.findByTestId('login')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ redirect: '/' });
    expect(screen.getByRole('link', { name: en.auth.google })).toHaveAttribute(
      'href',
      '/api/auth/google',
    );
  });

  it('links the repository for self-hosting, twice and always to the same place', async () => {
    await renderApp('/', { session: null });
    await screen.findByTestId('landing');

    const links = screen.getAllByRole('link', {
      name: new RegExp(`${en.landing.hero.repo}|${en.landing.footer.repo}`),
    });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute('href', REPO_URL);
    expect(screen.getByText(en.landing.footer.licence)).toBeInTheDocument();
  });

  it('shows the app in both themes and describes it for screen readers', async () => {
    await renderApp('/', { session: null });
    await screen.findByTestId('landing');

    const shots = screen.getAllByRole('img', { name: en.landing.hero.shot });
    expect(shots.map((img) => img.getAttribute('src'))).toEqual([
      '/landing/app-light.png',
      '/landing/app-dark.png',
    ]);
  });

  it('asks the API for nothing but the session', async () => {
    api.user = null;
    await renderApp('/', { session: 'fetch' });
    await screen.findByTestId('landing');

    expect(api.calls.map((call) => call.path)).toEqual(['/api/auth/me']);
  });

  it('switches language from the footer and remembers the choice', async () => {
    const user = userEvent.setup();
    await renderApp('/', { session: null });
    await screen.findByTestId('landing');

    const group = screen.getByRole('group', { name: en.landing.footer.language });
    const spanish = within(group).getByRole('button', { name: 'Español' });
    expect(within(group).getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(spanish);
    expect(
      await screen.findByRole('heading', { level: 1, name: es.landing.hero.title }),
    ).toBeInTheDocument();
    await waitFor(() => expect(spanish).toHaveAttribute('aria-pressed', 'true'));
    expect(localStorage.getItem('bookguardian.locale')).toBe('es');
    expect(document.documentElement.lang).toBe('es');
    expect(document.title).toBe(es.landing.meta.title);
  });

  it('titles the tab with the landing copy and gives it back on the way out', async () => {
    document.title = 'Bookguardian';
    const user = userEvent.setup();
    await renderApp('/', { session: null });
    await screen.findByTestId('landing');
    expect(document.title).toBe(en.landing.meta.title);

    await user.click(screen.getByTestId('landing-login'));
    expect(await screen.findByTestId('login')).toBeInTheDocument();
    expect(document.title).toBe('Bookguardian');
  });
});

describe('/ with a session', () => {
  let api: FakeApi;
  beforeEach(() => {
    api = installFakeApi();
    seedFakeApi(api);
  });
  afterEach(() => {
    api.restore();
  });

  it('is the library, and the landing never mounts', async () => {
    const { router } = await renderApp('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: en.library.title }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByTestId('tabbar')).toBeInTheDocument();
    expect(screen.queryByTestId('landing')).not.toBeInTheDocument();
  });

  it('still sends a visitor without a session away from a private route', async () => {
    const { router } = await renderApp('/stats', { session: null });

    expect(await screen.findByTestId('login')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ redirect: '/stats' });
    expect(screen.queryByTestId('landing')).not.toBeInTheDocument();
  });
});
