import { render, screen } from '@testing-library/react';
import { en } from '@bookguardian/shared/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { installFakeApi, type FakeApi } from './fake-api';

describe('App', () => {
  let api: FakeApi;
  beforeEach(() => {
    api = installFakeApi();
  });
  afterEach(() => {
    api.restore();
  });

  it('mounts the router and query client over browser history, checking the session first', async () => {
    window.history.replaceState({}, '', '/stats');
    render(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: en.stats.title }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('tabbar').querySelectorAll('a')).toHaveLength(5);
    expect(api.calls[0]).toMatchObject({ method: 'GET', path: '/api/auth/me' });
  });

  it('lands on /login when there is no session, remembering the destination', async () => {
    api.user = null;
    window.history.replaceState({}, '', '/lending');
    render(<App />);
    expect(await screen.findByTestId('login')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(new URLSearchParams(window.location.search).get('redirect')).toBe('/lending');
    expect(screen.queryByTestId('tabbar')).not.toBeInTheDocument();
  });
});
