/**
 * Metadata lookup: Open Library first, Google Books as fallback, results
 * cached per ISBN / per query so a rescan or a retried OCR guess is instant.
 *
 * A provider failure is logged and treated as "no result" — the user can
 * still add the book by hand — but if *every* provider failed the caller
 * gets a `LookupUnavailableError` so the UI can say "try again" rather than
 * "unknown book".
 */
import type { BookDraft } from '@bookguardian/shared';
import { TtlCache } from './cache';
import { googleBooksProvider } from './google-books';
import { openLibraryProvider } from './open-library';
import { ProviderError, type FetchLike, type LookupProvider, type ProviderContext } from './types';

export class LookupUnavailableError extends Error {
  constructor(public readonly causes: ProviderError[]) {
    super('Every metadata provider failed');
    this.name = 'LookupUnavailableError';
  }
}

export interface LookupService {
  /** `null` when no provider knows the ISBN. */
  byIsbn(isbn13: string): Promise<BookDraft | null>;
  /** Best matches for a free-text query, at most `limit`. */
  search(query: string, limit: number): Promise<BookDraft[]>;
}

export interface LookupServiceOptions {
  providers: LookupProvider[];
  fetch?: FetchLike;
  timeoutMs?: number;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  now?: () => number;
  log?: (message: string) => void;
}

export function createLookupService({
  providers,
  fetch = (input, init) => globalThis.fetch(input, init),
  timeoutMs = 8_000,
  cacheTtlMs = 24 * 60 * 60 * 1000,
  cacheMaxEntries = 1000,
  now = Date.now,
  log = (message) => console.warn(`[lookup] ${message}`),
}: LookupServiceOptions): LookupService {
  const ctx: ProviderContext = { fetch, timeoutMs };
  const isbnCache = new TtlCache<BookDraft | null>({
    ttlMs: cacheTtlMs,
    maxEntries: cacheMaxEntries,
    now,
  });
  const searchCache = new TtlCache<BookDraft[]>({
    ttlMs: cacheTtlMs,
    maxEntries: cacheMaxEntries,
    now,
  });
  // Coalesce concurrent identical requests (double taps, retries) into one fetch.
  const inflight = new Map<string, Promise<unknown>>();

  function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
    const pending = inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    const promise = run().finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  async function firstResult<T>(
    attempt: (provider: LookupProvider) => Promise<T | null>,
  ): Promise<T | null> {
    const failures: ProviderError[] = [];
    for (const provider of providers) {
      try {
        const result = await attempt(provider);
        if (result !== null) return result;
      } catch (error) {
        const failure =
          error instanceof ProviderError
            ? error
            : new ProviderError(provider.name, error instanceof Error ? error.message : 'failed');
        failures.push(failure);
        log(failure.message);
      }
    }
    if (failures.length > 0 && failures.length === providers.length) {
      throw new LookupUnavailableError(failures);
    }
    return null;
  }

  return {
    byIsbn(isbn13) {
      const cached = isbnCache.get(isbn13);
      if (cached !== undefined) return Promise.resolve(cached);
      return dedupe(`isbn:${isbn13}`, async () => {
        const draft = await firstResult((provider) => provider.byIsbn(isbn13, ctx));
        isbnCache.set(isbn13, draft);
        return draft;
      });
    },

    search(query, limit) {
      const normalized = query.trim().replace(/\s+/g, ' ').toLowerCase();
      const key = `${limit}:${normalized}`;
      const cached = searchCache.get(key);
      if (cached !== undefined) return Promise.resolve(cached);
      return dedupe(`search:${key}`, async () => {
        const items =
          (await firstResult(async (provider) => {
            const results = await provider.search(normalized, limit, ctx);
            return results.length > 0 ? results : null;
          })) ?? [];
        searchCache.set(key, items);
        return items;
      });
    },
  };
}

export interface DefaultLookupConfig {
  openLibraryUrl: string;
  googleBooksUrl: string;
  googleBooksApiKey?: string;
  cacheTtlMs: number;
  timeoutMs: number;
}

/** The production wiring: Open Library → Google Books, global fetch. */
export function createDefaultLookupService(config: DefaultLookupConfig): LookupService {
  return createLookupService({
    providers: [
      openLibraryProvider({ baseUrl: config.openLibraryUrl }),
      googleBooksProvider({ baseUrl: config.googleBooksUrl, apiKey: config.googleBooksApiKey }),
    ],
    cacheTtlMs: config.cacheTtlMs,
    timeoutMs: config.timeoutMs,
  });
}
