import { render, screen } from '@testing-library/react';
import { en } from '@bookguardian/shared/i18n';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '../src/components/EmptyState';
import { Screen } from '../src/components/Screen';
import { TABS } from '../src/components/tabs';

describe('EmptyState', () => {
  it('renders title, body and the default "coming soon" pill', () => {
    render(<EmptyState title="Nothing here" body="Add something." />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.getByText('Add something.')).toBeInTheDocument();
    expect(screen.getByText(en.common.comingSoon)).toBeInTheDocument();
  });

  it('omits the body and swaps the action when provided', () => {
    render(<EmptyState title="T" action={<button type="button">Add</button>} />);
    expect(screen.queryByText(en.common.comingSoon)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByRole('status').querySelector('p')).toBeNull();
  });
});

describe('Screen', () => {
  it('renders an h1 title, optional actions and children', () => {
    render(
      <Screen title="Library" actions={<button type="button">Sort</button>}>
        <p>content</p>
      </Screen>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sort' })).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});

describe('TABS', () => {
  it('has one entry per navigation key, each with a unique route', () => {
    expect(TABS.map((t) => t.labelKey)).toEqual(Object.keys(en.nav).map((k) => `nav.${k}`));
    expect(new Set(TABS.map((t) => t.to)).size).toBe(TABS.length);
  });
});
