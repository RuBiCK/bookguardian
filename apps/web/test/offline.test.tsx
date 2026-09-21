import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { en } from '@bookguardian/shared/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiClientError } from '../src/api/client';
import { createQueryClient } from '../src/lib/query-client';
import { showToast, useToasts } from '../src/lib/toast';
import { installFakeApi, seedFakeApi, type FakeApi } from './fake-api';
import { renderApp } from './render';

let api: FakeApi;
beforeEach(() => {
  api = installFakeApi();
  seedFakeApi(api);
});
afterEach(() => {
  api.restore();
  onlineManager.setOnline(true);
});

describe('offline', () => {
  it('shows the offline banner on every screen while the connection is gone', async () => {
    await renderApp('/');
    await screen.findByTestId('library-list');
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();

    onlineManager.setOnline(false);
    expect(await screen.findByTestId('offline-banner')).toHaveTextContent(en.offline.title);

    await userEvent.setup().click(screen.getByRole('link', { name: en.nav.settings }));
    await screen.findByRole('heading', { level: 1, name: en.settings.title });
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();

    onlineManager.setOnline(true);
    await waitFor(() => expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument());
  });

  it('turns every failed write into the offline explanation', () => {
    const { result } = renderHook(() => useToasts());
    onlineManager.setOnline(false);
    act(() => void showToast(en.errors.saveFailed, 'error'));
    expect(result.current.map((t) => t.message)).toEqual([en.errors.offline]);
    onlineManager.setOnline(true);
    act(() => void showToast(en.errors.saveFailed, 'error'));
    expect(result.current.map((t) => t.message)).toEqual([en.errors.offline, en.errors.saveFailed]);
    // Plain confirmations are left alone.
    onlineManager.setOnline(false);
    act(() => void showToast('Saved'));
    expect(result.current.at(-1)?.message).toBe('Saved');
  });

  it('keeps the saved library readable and fails writes fast', async () => {
    api.addBook({ title: 'Dune' });
    const { queryClient } = await renderApp('/');
    await screen.findByTestId('library-list');

    onlineManager.setOnline(false);
    api.failNext({ method: 'POST', path: /\/api\/books$/ }, 503);
    const u = userEvent.setup();
    await u.click(screen.getByTestId('fab'));
    const sheet = await screen.findByRole('dialog', { name: en.books.add });
    await u.type(screen.getByLabelText(en.books.field.title), 'Emma');
    await u.click(screen.getByRole('button', { name: en.common.save }));
    // The mutation ran (networkMode "always"), failed, and rolled back with the offline message.
    expect(await screen.findByText(en.errors.offline)).toBeInTheDocument();
    expect(sheet).not.toBeInTheDocument();
    await waitFor(() => expect(api.books.map((b) => b.title)).toEqual(['Dune']));
    expect(queryClient.getQueryData(['libraries'])).toBeDefined();
  });

  it('does not retry queries while offline, and never retries a 401', () => {
    const client = createQueryClient();
    const retry = client.getDefaultOptions().queries!.retry as (n: number, e: Error) => boolean;
    expect(retry(0, new Error('boom'))).toBe(true);
    expect(retry(2, new Error('boom'))).toBe(false);
    expect(retry(0, new ApiClientError(401, 'unauthenticated', 'no'))).toBe(false);
    onlineManager.setOnline(false);
    expect(retry(0, new Error('boom'))).toBe(false);
    expect(client.getDefaultOptions().queries!.networkMode).toBe('offlineFirst');
    expect(client.getDefaultOptions().mutations!.networkMode).toBe('always');
  });
});
