import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { en } from '@bookguardian/shared/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from './render';

function mockHealth(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

const online = {
  status: 'ok',
  version: '0.1.0',
  uptimeSeconds: 1,
  database: { driver: 'postgres', reachable: true },
};

describe('settings screen', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = 'system';
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('switches theme, persists it and reflects the pressed state', async () => {
    mockHealth(online);
    const user = userEvent.setup();
    await renderApp('/settings');

    const group = await screen.findByRole('group', { name: en.settings.theme.label });
    const dark = screen.getByRole('button', { name: en.settings.theme.dark });
    expect(screen.getByRole('button', { name: en.settings.theme.system })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(dark);
    expect(dark).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('bookguardian.theme')).toBe('dark');
    expect(group.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: en.settings.theme.light }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('shows the API driver when online', async () => {
    mockHealth(online);
    await renderApp('/settings');
    await waitFor(() =>
      expect(screen.getByTestId('api-status')).toHaveTextContent('Online (postgres)'),
    );
  });

  it('shows offline when the health request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await renderApp('/settings');
    await waitFor(() =>
      expect(screen.getByTestId('api-status')).toHaveTextContent(en.settings.apiStatus.offline),
    );
  });

  it('shows the app version from the build', async () => {
    mockHealth(online);
    await renderApp('/settings');
    expect(await screen.findByText(/Version \d+\.\d+\.\d+/)).toBeInTheDocument();
  });
});

describe('settings · missing covers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts a backfill, shows progress and the final tally', async () => {
    const { installFakeApi, seedFakeApi } = await import('./fake-api');
    const api = installFakeApi();
    seedFakeApi(api);
    api.backfillQueued = 3;
    const user = userEvent.setup();
    await renderApp('/settings');

    const button = await screen.findByRole('button', { name: en.settings.covers.find });
    expect(screen.queryByTestId('covers-progress')).not.toBeInTheDocument();
    await user.click(button);
    expect(
      await screen.findByRole('button', { name: en.settings.covers.searching }),
    ).toBeDisabled();
    expect(await screen.findByTestId('covers-progress')).toHaveTextContent('0 of 3 checked');
    expect(api.calls.some((c) => c.method === 'POST' && c.path === '/api/covers/backfill')).toBe(
      true,
    );

    // The API works through the queue; the screen polls the status.
    api.backfill = { queued: 3, pending: 1, done: 2, found: 1, failed: 0 };
    await waitFor(
      () => expect(screen.getByTestId('covers-progress')).toHaveTextContent('2 of 3 checked'),
      {
        timeout: 4000,
      },
    );
    api.backfill = { queued: 3, pending: 0, done: 3, found: 2, failed: 0 };
    await waitFor(
      () => expect(screen.getByTestId('covers-progress')).toHaveTextContent('2 of 3 covers found'),
      { timeout: 4000 },
    );
    expect(screen.getByRole('button', { name: en.settings.covers.find })).toBeEnabled();
    api.restore();
  });

  it('says so when every book already has a cover', async () => {
    const { installFakeApi, seedFakeApi } = await import('./fake-api');
    const api = installFakeApi();
    seedFakeApi(api);
    api.backfillQueued = 0;
    await renderApp('/settings');
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: en.settings.covers.find }));
    expect(await screen.findByText(en.settings.covers.nothing)).toBeInTheDocument();
    expect(screen.queryByTestId('covers-progress')).not.toBeInTheDocument();
    api.restore();
  });
});

describe('settings · account', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows who is signed in', async () => {
    const { installFakeApi, seedFakeApi } = await import('./fake-api');
    const api = installFakeApi();
    seedFakeApi(api);
    await renderApp('/settings');
    expect(await screen.findByTestId('account-email')).toHaveTextContent(
      'Signed in as ada@example.test',
    );
    expect(
      screen.getByRole('button', { name: en.settings.account.deleteAccount }),
    ).toBeInTheDocument();
    api.restore();
  });

  it('hides the section without a session', async () => {
    const { installFakeApi, seedFakeApi } = await import('./fake-api');
    const api = installFakeApi();
    seedFakeApi(api);
    api.account = null;
    await renderApp('/settings');
    await screen.findByRole('group', { name: en.settings.theme.label });
    await waitFor(() => expect(api.calls.some((c) => c.path === '/api/auth/me')).toBe(true));
    expect(screen.queryByTestId('account-row')).not.toBeInTheDocument();
    api.restore();
  });

  it('deletes the account only after a warning and the email typed back', async () => {
    const { installFakeApi, seedFakeApi } = await import('./fake-api');
    const api = installFakeApi();
    seedFakeApi(api);
    const user = userEvent.setup();
    const { router } = await renderApp('/settings');

    await user.click(
      await screen.findByRole('button', { name: en.settings.account.deleteAccount }),
    );
    const warning = await screen.findByRole('dialog', { name: en.settings.account.deleteTitle });
    expect(warning).toHaveTextContent(en.settings.account.deleteBody);
    // Nothing has been sent yet.
    expect(api.calls.some((c) => c.method === 'DELETE')).toBe(false);

    await user.click(screen.getByRole('button', { name: en.settings.account.deleteContinue }));
    const confirm = await screen.findByRole('dialog', { name: en.settings.account.confirmTitle });
    const final = screen.getByRole('button', { name: en.settings.account.deleteFinal });
    expect(final).toBeDisabled();

    const input = screen.getByLabelText(en.settings.account.confirmEmailLabel);
    await user.type(input, 'someone-else@example.test');
    expect(final).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(en.settings.account.mismatch);

    await user.clear(input);
    await user.type(input, 'Ada@Example.test');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(final).toBeEnabled();
    await user.click(final);

    await waitFor(() => expect(confirm).not.toBeInTheDocument());
    const call = api.calls.find((c) => c.method === 'DELETE' && c.path === '/api/auth/me');
    expect(call?.body).toEqual({ confirmEmail: 'Ada@Example.test' });
    expect(api.account).toBeNull();
    expect(await screen.findByText(en.settings.account.deleted)).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    api.restore();
  });

  it('cancelling either step sends nothing', async () => {
    const { installFakeApi, seedFakeApi } = await import('./fake-api');
    const api = installFakeApi();
    seedFakeApi(api);
    const user = userEvent.setup();
    await renderApp('/settings');

    await user.click(
      await screen.findByRole('button', { name: en.settings.account.deleteAccount }),
    );
    await user.click(screen.getByRole('button', { name: en.common.cancel }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: en.settings.account.deleteAccount }));
    await user.click(screen.getByRole('button', { name: en.settings.account.deleteContinue }));
    await user.type(
      screen.getByLabelText(en.settings.account.confirmEmailLabel),
      'ada@example.test',
    );
    await user.click(screen.getByRole('button', { name: en.common.cancel }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(api.account).not.toBeNull();
    api.restore();
  });

  it('reports a failed deletion and keeps the account', async () => {
    const { installFakeApi, seedFakeApi } = await import('./fake-api');
    const api = installFakeApi();
    seedFakeApi(api);
    const user = userEvent.setup();
    await renderApp('/settings');

    await user.click(
      await screen.findByRole('button', { name: en.settings.account.deleteAccount }),
    );
    await user.click(screen.getByRole('button', { name: en.settings.account.deleteContinue }));
    await user.type(
      screen.getByLabelText(en.settings.account.confirmEmailLabel),
      'ada@example.test',
    );
    api.failNext({ method: 'DELETE', path: /^\/api\/auth\/me$/ }, 500);
    await user.click(screen.getByRole('button', { name: en.settings.account.deleteFinal }));
    expect(await screen.findByText(en.settings.account.failed)).toBeInTheDocument();
    expect(api.account).not.toBeNull();
    api.restore();
  });
});
