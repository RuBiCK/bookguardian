import { onlineManager } from '@tanstack/react-query';
import i18next from 'i18next';
import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((fn) => fn());
}

function remove(id: number) {
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
  toasts = toasts.filter((t) => t.id !== id);
}

/**
 * Show a short, non-blocking message above the tab bar.
 *
 * Repeating the same message (e.g. adding two books back-to-back) replaces
 * the earlier toast and restarts its timer instead of stacking duplicates;
 * different messages still stack so an error never hides a confirmation.
 */
export function showToast(message: string, tone: Toast['tone'] = 'info', ttlMs = 3000) {
  // Offline, every failed write has the same cause; say so instead of "couldn't save".
  if (tone === 'error' && !onlineManager.isOnline()) message = i18next.t('errors.offline');
  const duplicate = toasts.find((t) => t.message === message && t.tone === tone);
  if (duplicate) remove(duplicate.id);
  const toast: Toast = { id: nextId++, message, tone };
  toasts = [...toasts, toast];
  timers.set(
    toast.id,
    setTimeout(() => dismissToast(toast.id), ttlMs),
  );
  emit();
  return toast.id;
}

export function dismissToast(id: number) {
  if (!toasts.some((t) => t.id === id)) return;
  remove(id);
  emit();
}

/** Drop every toast at once (tests, sign-out). */
export function clearToasts() {
  if (toasts.length === 0) return;
  for (const toast of toasts) remove(toast.id);
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const getSnapshot = () => toasts;

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
