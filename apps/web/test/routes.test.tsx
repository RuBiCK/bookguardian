import { screen } from '@testing-library/react';
import { en } from '@bookguardian/shared/i18n';
import { describe, expect, it } from 'vitest';
import { renderApp } from './render';

describe('routes', () => {
  it.each([
    ['/scan', en.scan.title, en.scan.placeholder],
    ['/lending', en.lending.title, en.lending.empty.title],
    ['/stats', en.stats.title, en.stats.placeholder],
  ])('%s renders its placeholder screen', async (path, title, text) => {
    await renderApp(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByTestId('tabbar')).toBeInTheDocument();
  });

  it('renders the not-found screen inside the shell for unknown paths', async () => {
    await renderApp('/does-not-exist');
    expect(
      await screen.findByRole('heading', { level: 1, name: en.errors.notFound }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('tabbar')).toBeInTheDocument();
  });
});
