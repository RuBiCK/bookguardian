/**
 * Motion and touch-feel helpers. Every animation in the app goes through the
 * same two gates: the OS "reduce motion" preference, and whether the platform
 * can animate at all (jsdom cannot — there the app must behave synchronously).
 */
import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

/** True when the person asked the OS to reduce motion. Safe to call anywhere. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Whether the Web Animations API is available (it is not in jsdom). */
export function canAnimate(): boolean {
  return typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
}

/**
 * A short vibration on platforms that expose one (Android browsers), for the
 * moments a native app would tick: a long press that opened something, a
 * swipe action that committed, a rating that changed. Silent elsewhere.
 */
export function haptic(pattern: number | number[] = 8): void {
  if (prefersReducedMotion()) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw without a user gesture */
  }
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void> };
};

/**
 * Whether a list-local view transition is in flight. Rows only carry their
 * per-item `view-transition-name` while it is: naming sixty rows all the
 * time would make every page navigation snapshot sixty extra elements.
 */
let listTransition = false;
const listListeners = new Set<() => void>();

function setListTransition(active: boolean) {
  if (listTransition === active) return;
  listTransition = active;
  listListeners.forEach((fn) => fn());
}

function subscribeList(fn: () => void) {
  listListeners.add(fn);
  return () => listListeners.delete(fn);
}

export function useListTransitionActive(): boolean {
  return useSyncExternalStore(
    subscribeList,
    () => listTransition,
    () => false,
  );
}

/** How long to give an optimistic update to reach the DOM inside the transition. */
const SETTLE_MS = 40;

/**
 * Run a same-document update inside a View Transition when the browser
 * supports it: rows slide into the gap a removed row leaves, badges
 * cross-fade instead of popping. `update` is usually an optimistic
 * mutation, whose cache write lands a tick later — the transition waits a
 * few milliseconds for it. Without support, or with reduced motion, the
 * update simply runs.
 */
export function withViewTransition(update: () => void): void {
  const doc = typeof document === 'undefined' ? undefined : (document as ViewTransitionDocument);
  if (!doc?.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  // Names must be in place before the "old" snapshot is taken.
  flushSync(() => setListTransition(true));
  const transition = doc.startViewTransition(async () => {
    update();
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  });
  const done = () => setListTransition(false);
  transition.finished.then(done, done);
}

/**
 * Names must be CSS identifiers; ids are UUIDs, which are safe after a
 * letter prefix. Used for shared-element transitions between a list and the
 * page it opens, and for list reflow animations.
 */
export function transitionName(prefix: string, id: string): string {
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
