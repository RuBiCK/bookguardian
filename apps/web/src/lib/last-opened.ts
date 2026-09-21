import { useSyncExternalStore } from 'react';

/**
 * Which book was opened last from a list. The list gives that one cover the
 * shared `view-transition-name`, so the browser can morph it into the book
 * page hero on the way in and back into its tile on the way out.
 */
let lastOpened: string | null = null;
const listeners = new Set<() => void>();

export function markOpened(bookId: string | null) {
  if (lastOpened === bookId) return;
  lastOpened = bookId;
  listeners.forEach((fn) => fn());
}

export function getLastOpened(): string | null {
  return lastOpened;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** True while `bookId` is the book that was opened last. */
export function useIsLastOpened(bookId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => lastOpened === bookId,
    () => false,
  );
}
