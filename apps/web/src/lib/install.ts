import { useCallback, useSyncExternalStore } from 'react';

/**
 * PWA install: Chromium browsers fire `beforeinstallprompt` once the app is
 * installable; we keep the event and replay it from an "Install" button.
 * iOS Safari has no prompt — the UI shows the Share → "Add to Home Screen"
 * instructions instead. Once running standalone there is nothing to offer.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'prompt' | 'ios' | 'installed' | 'unavailable';

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  );
}

export function isIosSafari(userAgent: string = navigator.userAgent): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent);
  const safari = userAgent.includes('Safari') && !/CriOS|FxiOS|EdgiOS/.test(userAgent);
  return ios && safari;
}

/** Call once at startup, before React renders, so the event is not missed. */
export function listenForInstallPrompt() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

/** Tests and the prompt itself reset the captured event. */
export function resetInstallPrompt() {
  deferred = null;
  installed = false;
  emit();
}

function platform(): InstallPlatform {
  if (installed || isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (typeof navigator !== 'undefined' && isIosSafari()) return 'ios';
  return 'unavailable';
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useInstallPrompt(): {
  platform: InstallPlatform;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
} {
  const current = useSyncExternalStore(subscribe, platform, () => 'unavailable' as const);
  const install = useCallback(async () => {
    const event = deferred;
    if (!event) return 'unavailable' as const;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') installed = true;
    deferred = null;
    emit();
    return outcome;
  }, []);
  return { platform: current, install };
}
