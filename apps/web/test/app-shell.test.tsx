import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { en } from '@bookguardian/shared/i18n';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from './render';

describe('app shell', () => {
  it('renders the five bottom tabs from the i18n dictionary', async () => {
    await renderApp('/');
    const nav = await screen.findByTestId('tabbar');
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(5);
    expect([...links].map((a) => a.textContent)).toEqual(Object.values(en.nav));
  });

  it('marks the active tab and navigates on tap', async () => {
    const user = userEvent.setup();
    await renderApp('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: en.library.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.nav.library })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(screen.getByRole('link', { name: en.nav.stats }));
    expect(
      await screen.findByRole('heading', { level: 1, name: en.stats.title }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: en.nav.stats })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
  });

  it('shows API status on the settings screen via TanStack Query', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          version: '0.1.0',
          uptimeSeconds: 1,
          database: { driver: 'sqlite', reachable: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    try {
      await renderApp('/settings');
      expect(
        await screen.findByRole('heading', { level: 1, name: en.settings.title }),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByTestId('api-status')).toHaveTextContent('Online (sqlite)'),
      );
      expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything());
    } finally {
      fetchMock.mockRestore();
    }
  });
});
