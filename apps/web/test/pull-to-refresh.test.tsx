import { act, fireEvent, render, screen } from '@testing-library/react';
import { en } from '@bookguardian/shared/i18n';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PullToRefresh, REFRESH_THRESHOLD } from '../src/components/PullToRefresh';

function Host({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <>
      <PullToRefresh onRefresh={onRefresh} contentRef={ref} />
      <main ref={ref} data-testid="main" />
    </>
  );
}

const touch = (type: string, y: number) =>
  fireEvent(
    document,
    new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: type === 'touchend' ? [] : [{ clientY: y, clientX: 10 } as Touch],
    }),
  );

afterEach(() => {
  window.scrollY = 0;
  document.body.style.overflow = '';
});

describe('PullToRefresh', () => {
  it('follows a downward pull from the top, arms past the threshold and refreshes on release', async () => {
    let resolve: () => void = () => undefined;
    const onRefresh = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<Host onRefresh={onRefresh} />);
    const indicator = screen.getByTestId('pull-to-refresh');
    const main = screen.getByTestId('main');
    expect(indicator).toHaveAttribute('data-state', 'idle');
    expect(indicator).toHaveAttribute('aria-hidden', 'true');

    touch('touchstart', 100);
    touch('touchmove', 140); // 40px of finger = 20px of page
    expect(indicator).toHaveAttribute('data-state', 'pulling');
    expect(indicator).toHaveAttribute('aria-label', en.refresh.pull);
    expect(main.style.transform).toBe('translateY(20px)');
    expect(main.dataset.pulling).toBe('true');

    touch('touchmove', 100 + REFRESH_THRESHOLD * 2 + 20);
    expect(indicator).toHaveAttribute('data-state', 'ready');
    expect(indicator).toHaveAttribute('aria-label', en.refresh.release);

    touch('touchend', 0);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(indicator).toHaveAttribute('data-state', 'refreshing');
    expect(main.style.transform).toBe(`translateY(${REFRESH_THRESHOLD}px)`);
    expect(main.dataset.pulling).toBe('false');

    await act(async () => {
      resolve();
      await Promise.resolve();
    });
    expect(indicator).toHaveAttribute('data-state', 'idle');
    expect(main.style.transform).toBe('');
  });

  it('lets go of a short pull without refreshing', () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    render(<Host onRefresh={onRefresh} />);
    touch('touchstart', 100);
    touch('touchmove', 130);
    touch('touchend', 0);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('pull-to-refresh')).toHaveAttribute('data-state', 'idle');
    expect(screen.getByTestId('main').style.transform).toBe('');
  });

  it('does nothing when scrolled down, when a sheet locks scrolling, or when scrolling up', () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    render(<Host onRefresh={onRefresh} />);
    const indicator = screen.getByTestId('pull-to-refresh');

    window.scrollY = 120;
    touch('touchstart', 100);
    touch('touchmove', 300);
    touch('touchend', 0);
    expect(indicator).toHaveAttribute('data-state', 'idle');
    window.scrollY = 0;

    document.body.style.overflow = 'hidden';
    touch('touchstart', 100);
    touch('touchmove', 300);
    touch('touchend', 0);
    expect(indicator).toHaveAttribute('data-state', 'idle');
    document.body.style.overflow = '';

    touch('touchstart', 300);
    touch('touchmove', 100);
    touch('touchmove', 400); // reversed after starting upwards: still nothing
    touch('touchend', 0);
    expect(indicator).toHaveAttribute('data-state', 'idle');
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('recovers when the refresh itself fails', async () => {
    const onRefresh = vi.fn(() => Promise.reject(new Error('offline')));
    render(<Host onRefresh={onRefresh} />);
    touch('touchstart', 100);
    touch('touchmove', 100 + REFRESH_THRESHOLD * 2 + 20);
    touch('touchend', 0);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('pull-to-refresh')).toHaveAttribute('data-state', 'idle');
  });
});
