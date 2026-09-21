import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type MouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ACTION_WIDTH, SwipeRow } from '../src/components/SwipeRow';

function Host({
  onLend = vi.fn(),
  onLink = vi.fn(),
}: {
  onLend?: () => void;
  onLink?: (event: MouseEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <SwipeRow
      testId="row"
      open={open}
      onOpenChange={setOpen}
      actions={[
        { key: 'lend', label: 'Lend', icon: <span />, tone: 'accent', onSelect: onLend },
        { key: 'move', label: 'Move', icon: <span />, onSelect: vi.fn() },
      ]}
    >
      <a href="#book" onClick={onLink}>
        Dune
      </a>
    </SwipeRow>
  );
}

/** jsdom has no PointerEvent; a MouseEvent with `pointerType` stands in. */
const finger = (el: Element, type: string, x: number, y = 10) => {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(el, event);
};
const mouse = (el: Element, type: string, x: number) => {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 10 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  Object.defineProperty(event, 'pointerId', { value: 2 });
  fireEvent(el, event);
};

const content = () => screen.getByTestId('row').querySelector<HTMLElement>('.swipe__content')!;
const tray = () => screen.getByTestId('row').querySelector<HTMLElement>('.swipe__actions')!;

describe('SwipeRow', () => {
  it('reveals the actions after a swipe past halfway and hides them on a tap', () => {
    const onLink = vi.fn((e: MouseEvent) => e.preventDefault());
    render(<Host onLink={onLink} />);
    const row = screen.getByTestId('row');
    expect(tray()).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Lend', hidden: true })).toHaveAttribute(
      'tabindex',
      '-1',
    );

    const width = 2 * ACTION_WIDTH;
    finger(content(), 'pointerdown', 200);
    finger(content(), 'pointermove', 195); // within the slop: not a swipe yet
    expect(row).not.toHaveAttribute('data-dragging');
    finger(content(), 'pointermove', 200 - width * 0.6);
    expect(row).toHaveAttribute('data-dragging', 'true');
    expect(content().style.transform).toBe(`translateX(${-width * 0.6}px)`);
    finger(content(), 'pointerup', 200 - width * 0.6);

    expect(row).toHaveAttribute('data-open', 'true');
    expect(content().style.transform).toBe(`translateX(${-width}px)`);
    expect(tray()).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByRole('button', { name: 'Lend' })).toHaveAttribute('tabindex', '0');
    // The tap that ended the swipe did not follow the link.
    fireEvent.click(screen.getByRole('link', { name: 'Dune' }));
    expect(onLink).not.toHaveBeenCalled();

    // Tapping the open row just closes it.
    fireEvent.click(screen.getByRole('link', { name: 'Dune' }));
    expect(onLink).not.toHaveBeenCalled();
    expect(row).not.toHaveAttribute('data-open');
    expect(content().style.transform).toBe('');

    // Closed again: a plain tap reaches the link.
    fireEvent.click(screen.getByRole('link', { name: 'Dune' }));
    expect(onLink).toHaveBeenCalledTimes(1);
  });

  it('snaps back from a short swipe, resists past the tray, and runs the action tapped', () => {
    const onLend = vi.fn();
    render(<Host onLend={onLend} />);
    const row = screen.getByTestId('row');
    const width = 2 * ACTION_WIDTH;

    finger(content(), 'pointerdown', 200);
    finger(content(), 'pointermove', 200 - width * 0.3);
    finger(content(), 'pointerup', 200 - width * 0.3);
    expect(row).not.toHaveAttribute('data-open');
    expect(content().style.transform).toBe('');

    finger(content(), 'pointerdown', 300);
    finger(content(), 'pointermove', 300 - width - 40); // 40px past the tray, damped to 10
    expect(content().style.transform).toBe(`translateX(${-width - 10}px)`);
    finger(content(), 'pointerup', 300 - width - 40);
    expect(row).toHaveAttribute('data-open', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Lend' }));
    expect(onLend).toHaveBeenCalledTimes(1);
    expect(row).not.toHaveAttribute('data-open');
  });

  it('leaves vertical scrolls, mouse drags and right-to-left pulls alone', () => {
    render(<Host />);
    const row = screen.getByTestId('row');

    finger(content(), 'pointerdown', 200, 10);
    finger(content(), 'pointermove', 190, 60); // mostly vertical: scrolling
    finger(content(), 'pointermove', 100, 60);
    finger(content(), 'pointerup', 100, 60);
    expect(row).not.toHaveAttribute('data-open');
    expect(content().style.transform).toBe('');

    mouse(content(), 'pointerdown', 200);
    mouse(content(), 'pointermove', 40);
    mouse(content(), 'pointerup', 40);
    expect(row).not.toHaveAttribute('data-open');

    // Pushing right from rest does nothing (there is no tray on the left).
    finger(content(), 'pointerdown', 100);
    finger(content(), 'pointermove', 180);
    expect(content().style.transform).toBe('');
    finger(content(), 'pointerup', 180);
    expect(row).not.toHaveAttribute('data-open');
  });
});
