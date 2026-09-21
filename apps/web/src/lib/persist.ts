import type { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
  type PersistedClient,
  type Persister,
} from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { CACHE_MAX_AGE_MS } from './query-client';

export const PERSIST_KEY = 'bookguardian.queryCache';

/** Query families worth keeping for offline reads. Covers are images the SW caches separately. */
const PERSISTED = new Set([
  'session',
  'defaults',
  'libraries',
  'shelves',
  'books',
  'book',
  'lendings',
  'stats',
]);

/** Only successful data, only the families that make the library readable offline. */
export function shouldPersistQuery(query: {
  queryKey: readonly unknown[];
  state: { status: string };
}): boolean {
  return query.state.status === 'success' && PERSISTED.has(String(query.queryKey[0]));
}

export function createPersister(
  storage: Storage | null | undefined = safeStorage(),
): Persister | null {
  if (!storage) return null;
  return createSyncStoragePersister({ storage, key: PERSIST_KEY, throttleTime: 1000 });
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined; // storage disabled (private mode quirks)
  }
}

/**
 * Restore the saved server state before the first render, then keep saving
 * it as it changes, so the library list opens offline with the last copy.
 * `buster` ties the saved copy to the app version: a new build starts clean.
 * Returns the unsubscribe function.
 */
export async function setupQueryPersistence(
  queryClient: QueryClient,
  buster: string,
  persister: Persister | null = createPersister(),
): Promise<() => void> {
  if (!persister) return () => undefined;
  const options = {
    queryClient,
    persister,
    buster,
    maxAge: CACHE_MAX_AGE_MS,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  };
  try {
    await persistQueryClientRestore(options);
    // What came off the disk is a starting point, not the truth: every
    // restored query is stale, so each screen refetches as soon as it
    // mounts (online) while showing the saved copy meanwhile.
    await queryClient.invalidateQueries({ refetchType: 'none' });
  } catch {
    // A corrupt or incompatible snapshot is not worth blocking the app for.
    await persister.removeClient();
  }
  return persistQueryClientSubscribe(options);
}

/** Drop everything saved for a signed-out account. */
export async function clearPersistedQueries(persister: Persister | null = createPersister()) {
  await persister?.removeClient();
}

export type { PersistedClient };
