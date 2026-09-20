import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { en } from '@bookguardian/shared/i18n';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '../src/components/EmptyState';
import { Screen } from '../src/components/Screen';
import { StarRating } from '../src/components/StarRating';
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

describe('Screen with a hero', () => {
  it('drops the built-in title so the hero can own the h1', () => {
    render(
      <Screen
        title="Dune"
        hero={<h1>Dune (hero)</h1>}
        actions={<button type="button">Edit</button>}
      >
        <p>content</p>
      </Screen>,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Dune (hero)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});

describe('StarRating', () => {
  /** Give the stars real geometry (jsdom lays nothing out): 5 stars × 40px starting at x=20. */
  const measure = (row: HTMLElement) => {
    row.querySelectorAll<HTMLElement>('[data-star]').forEach((star, i) => {
      const left = 20 + i * 40;
      star.getBoundingClientRect = () =>
        ({ left, width: 40, top: 0, height: 40, right: left + 40, bottom: 40 }) as DOMRect;
    });
  };
  const pointer = (el: Element, type: string, x: number) =>
    fireEvent(el, new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 10 }));

  it('slides the rating while dragging and commits where the finger lifts', () => {
    const onChange = vi.fn();
    render(<StarRating value={2} onChange={onChange} />);
    const row = screen.getByRole('group', { name: en.reading.rating });
    measure(row);
    const star = (n: number) =>
      screen.getByRole('button', { name: n === 1 ? '1 star' : `${n} stars` });

    pointer(star(1), 'pointerdown', 5); // before the first star still counts as 1
    expect(star(1)).toHaveClass('rating__star--on');
    expect(star(2)).not.toHaveClass('rating__star--on');
    pointer(row, 'pointermove', 150); // over the 4th star (140–180)
    expect(star(4)).toHaveClass('rating__star--on');
    expect(star(5)).not.toHaveClass('rating__star--on');
    pointer(row, 'pointermove', 500); // past the end clamps to 5
    expect(star(5)).toHaveClass('rating__star--on');
    pointer(row, 'pointerup', 205);
    expect(onChange).toHaveBeenCalledWith(5);
    // Nothing committed yet: the value prop is still 2, preview is gone.
    expect(star(3)).not.toHaveClass('rating__star--on');
  });

  it('clears when the selected star is tapped again, and is keyboard operable', async () => {
    const onChange = vi.fn();
    render(<StarRating value={3} onChange={onChange} />);
    const row = screen.getByRole('group', { name: en.reading.rating });
    measure(row);
    const star = (n: number) => screen.getByRole('button', { name: `${n} stars` });

    pointer(star(3), 'pointerdown', 110);
    pointer(row, 'pointerup', 110);
    expect(onChange).toHaveBeenLastCalledWith(0);

    // A tap on a different star just selects it; a drag that ends back on the
    // current star keeps it (only a plain tap clears).
    pointer(star(2), 'pointerdown', 70);
    pointer(row, 'pointerup', 70);
    expect(onChange).toHaveBeenLastCalledWith(2);
    pointer(star(3), 'pointerdown', 110);
    pointer(row, 'pointermove', 150);
    pointer(row, 'pointerup', 110);
    expect(onChange).toHaveBeenLastCalledWith(3);

    // Cancelled gestures change nothing.
    onChange.mockClear();
    pointer(star(5), 'pointerdown', 190);
    fireEvent.pointerCancel(row);
    expect(onChange).not.toHaveBeenCalled();
    expect(star(5)).not.toHaveClass('rating__star--on');

    // Keyboard: Enter / Space activate the focused star (click with detail 0).
    star(4).focus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(4);
    star(3).focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(0); // current value is 3 → toggles off
    expect(row).toHaveTextContent('3 stars');
  });
});
