import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canAnimate,
  haptic,
  prefersReducedMotion,
  transitionName,
  withViewTransition,
} from '../src/lib/motion';

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({ matches }),
  });
};

afterEach(() => {
  // jsdom has no matchMedia; tests that add one remove it again.
  delete (window as { matchMedia?: unknown }).matchMedia;
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  delete (navigator as { vibrate?: unknown }).vibrate;
});

describe('prefersReducedMotion', () => {
  it('is false where matchMedia does not exist (jsdom) and follows the query elsewhere', () => {
    expect(prefersReducedMotion()).toBe(false);
    mockMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    mockMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('canAnimate', () => {
  it('reports the Web Animations API (absent in jsdom)', () => {
    expect(canAnimate()).toBe(false);
    Element.prototype.animate = vi.fn();
    try {
      expect(canAnimate()).toBe(true);
    } finally {
      delete (Element.prototype as { animate?: unknown }).animate;
    }
  });
});

describe('haptic', () => {
  it('vibrates briefly when the platform allows it, never under reduced motion', () => {
    haptic(); // no vibrate API: nothing happens, nothing throws
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    haptic();
    expect(vibrate).toHaveBeenCalledWith(8);
    haptic([10, 20]);
    expect(vibrate).toHaveBeenLastCalledWith([10, 20]);
    mockMatchMedia(true);
    vibrate.mockClear();
    haptic();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('swallows a browser that throws without a user gesture', () => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: () => {
        throw new Error('gesture required');
      },
    });
    expect(() => haptic()).not.toThrow();
  });
});

describe('withViewTransition', () => {
  it('runs the update directly without the API or under reduced motion', () => {
    const update = vi.fn();
    withViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);

    const start = vi.fn();
    (document as { startViewTransition?: unknown }).startViewTransition = start;
    mockMatchMedia(true);
    withViewTransition(update);
    expect(update).toHaveBeenCalledTimes(2);
    expect(start).not.toHaveBeenCalled();
  });

  it('wraps the update in a document view transition when supported', async () => {
    vi.useFakeTimers();
    try {
      const update = vi.fn();
      let finish: () => void = () => undefined;
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const start = vi.fn((cb: () => Promise<void>) => {
        void cb();
        return { finished };
      });
      (document as { startViewTransition?: unknown }).startViewTransition = start;
      withViewTransition(update);
      expect(start).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledTimes(1);
      await vi.runAllTimersAsync();
      finish();
      await finished;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('transitionName', () => {
  it('turns an id into a CSS identifier', () => {
    expect(transitionName('row', 'a1b2-c3d4')).toBe('row-a1b2-c3d4');
    expect(transitionName('row', 'we ird/id!')).toBe('row-weirdid');
  });
});
