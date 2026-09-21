import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import {
  clearPersistedQueries,
  createPersister,
  PERSIST_KEY,
  setupQueryPersistence,
  shouldPersistQuery,
} from '../src/lib/persist';
import { createQueryClient } from '../src/lib/query-client';

function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 1100));

describe('query persistence', () => {
  it('keeps only successful server state from the offline-worthy families', () => {
    const ok = (key: unknown[]) =>
      shouldPersistQuery({ queryKey: key, state: { status: 'success' } });
    expect(ok(['libraries'])).toBe(true);
    expect(ok(['books', { shelfId: 'x' }])).toBe(true);
    expect(ok(['session'])).toBe(true);
    expect(ok(['health'])).toBe(false);
    expect(ok(['covers-backfill'])).toBe(false);
    expect(shouldPersistQuery({ queryKey: ['books'], state: { status: 'error' } })).toBe(false);
    expect(shouldPersistQuery({ queryKey: ['books'], state: { status: 'pending' } })).toBe(false);
  });

  it('restores what an earlier client saved, and drops it when the app version changes', async () => {
    const storage = memoryStorage();
    const first = createQueryClient();
    const stop = await setupQueryPersistence(first, 'v1', createPersister(storage));
    first.setQueryData(['libraries'], [{ id: 'lib-1', name: 'My Library' }]);
    first.setQueryData(['health'], { status: 'ok' });
    await flush();
    stop();
    expect(storage.getItem(PERSIST_KEY)).toContain('My Library');
    expect(storage.getItem(PERSIST_KEY)).not.toContain('"health"');

    const second = createQueryClient();
    await setupQueryPersistence(second, 'v1', createPersister(storage));
    expect(second.getQueryData(['libraries'])).toEqual([{ id: 'lib-1', name: 'My Library' }]);
    expect(second.getQueryData(['health'])).toBeUndefined();
    // Restored data is shown, but treated as stale so screens refetch on mount.
    expect(second.getQueryState(['libraries'])?.isInvalidated).toBe(true);

    const third = createQueryClient();
    await setupQueryPersistence(third, 'v2', createPersister(storage));
    expect(third.getQueryData(['libraries'])).toBeUndefined();
  });

  it('survives a corrupt snapshot and does nothing without storage', async () => {
    const storage = memoryStorage();
    storage.setItem(PERSIST_KEY, '{not json');
    const client = createQueryClient();
    await expect(setupQueryPersistence(client, 'v1', createPersister(storage))).resolves.toBeTypeOf(
      'function',
    );
    expect(storage.getItem(PERSIST_KEY)).toBeNull();

    expect(createPersister(null)).toBeNull();
    const stop = await setupQueryPersistence(new QueryClient(), 'v1', null);
    expect(stop).toBeTypeOf('function');
    await expect(clearPersistedQueries(null)).resolves.toBeUndefined();
  });

  it('clears the saved copy on demand', async () => {
    const storage = memoryStorage();
    storage.setItem(PERSIST_KEY, '{}');
    await clearPersistedQueries(createPersister(storage));
    expect(storage.getItem(PERSIST_KEY)).toBeNull();
  });
});
