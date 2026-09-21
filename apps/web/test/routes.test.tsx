import { screen } from '@testing-library/react';
import { en } from '@bookguardian/shared/i18n';
import { describe, expect, it } from 'vitest';
import { renderApp } from './render';

describe('routes', () => {
  it('renders the not-found screen inside the shell for unknown paths', async () => {
    await renderApp('/does-not-exist');
    expect(
      await screen.findByRole('heading', { level: 1, name: en.errors.notFound }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('tabbar')).toBeInTheDocument();
  });
});
