import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** Live online/offline state, from the same manager TanStack Query pauses on. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (fn) => onlineManager.subscribe(fn),
    () => onlineManager.isOnline(),
    () => true,
  );
}
