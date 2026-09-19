import { render, screen } from '@testing-library/react';
import { en } from '@bookguardian/shared/i18n';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('App', () => {
  it('mounts the router and query client over browser history', async () => {
    window.history.replaceState({}, '', '/stats');
    render(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: en.stats.title }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('tabbar').querySelectorAll('a')).toHaveLength(5);
  });
});
