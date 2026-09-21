import { useCallback, useSyncExternalStore } from 'react';

/**
 * A small preference persisted in localStorage (the book list view, a
 * dismissed banner), readable from any component and kept in sync between
 * them. Values are validated on read so garbage in storage falls back to
 * the default.
 */
const listeners = new Map<string, Set<() => void>>();

function read<T extends string>(key: string, valid: readonly T[], fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  const stored = localStorage.getItem(key);
  return (valid as readonly string[]).includes(stored ?? '') ? (stored as T) : fallback;
}

export function writeStoredValue(key: string, value: string) {
  localStorage.setItem(key, value);
  listeners.get(key)?.forEach((fn) => fn());
}

export function useStoredValue<T extends string>(
  key: string,
  valid: readonly T[],
  fallback: T,
): [T, (value: T) => void] {
  const subscribe = useCallback(
    (fn: () => void) => {
      const set = listeners.get(key) ?? new Set();
      set.add(fn);
      listeners.set(key, set);
      return () => set.delete(fn);
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, valid, fallback),
    () => fallback,
  );
  const setValue = useCallback((next: T) => writeStoredValue(key, next), [key]);
  return [value, setValue];
}
