import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { initI18n } from '../src/i18n';
import { clearToasts } from '../src/lib/toast';

// Node >= 25 defines a `localStorage` global that stays `undefined` unless the
// process runs with --localstorage-file, and vitest's jsdom environment does
// not replace a global that already exists. Provide a minimal in-memory
// Storage so theme persistence can be tested on any Node version.
if (globalThis.localStorage === undefined) {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}

initI18n();

afterEach(() => {
  cleanup();
  clearToasts();
});

// jsdom does not implement scrolling; TanStack Router calls it on navigation.
window.scrollTo = () => undefined;
