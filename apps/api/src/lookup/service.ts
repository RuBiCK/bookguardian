/**
 * Metadata lookup: the shared `catalog_books` table first, then Open Library,
 * then Google Books. An ISBN is fetched online at most once per instance —
 * the row survives restarts and is shared by every user — and concurrent
 * requests for the same ISBN share one provider round-trip.
 *
 * Rows are served stale-while-revalidate: past `refreshMs` they are returned
 * immediately and refreshed in the background, a failed refresh leaves them
 * untouched. A miss is remembered for `missMs` so unknown ISBNs do not hammer
 * the providers, then retried (new books do show up later).
 *
 * Search (free text and/or the fields of a half-filled form) asks every
 * provider at once and merges the answers: the same ISBN from two providers
 * is one result, exact ISBN matches come first, then title + author matches
 * (see `rank.ts`). Results are volatile and only cached in memory, but every
 * result with an ISBN-13 is stored opportunistically so tapping a candidate
 * never fetches again.
 *
 * A provider failure is logged and treated as "no result" — the user can
 * still add the book by hand — but if *every* provider failed the caller
 * gets a `LookupUnavailableError` so the UI can say "try again" rather than
 * "unknown book".
 */
import type { BookDraft, LookupSearchResult } from '@bookguardian/shared';
import { hitRow, missRow, type CatalogBookRepository } from '../db/repositories/catalog-books';
import { TtlCache } from './cache';
import { googleBooksProvider } from './google-books';
import { openLibraryProvider } from './open-library';
import { mergeResults } from './rank';
import {
  ProviderError,
  type FetchLike,
  type LookupProvider,
  type ProviderContext,
  type SearchQuery,
} from './types';

export class LookupUnavailableError extends Error {
  constructor(public readonly causes: ProviderError[]) {
    super('Every metadata provider failed');
    this.name = 'LookupUnavailableError';
  }
}

export interface LookupService {
  /** `null` when no provider knows the ISBN. */
  byIsbn(isbn13: string): Promise<BookDraft | null>;
  /** Best matches across every provider, deduplicated and ranked, at most `limit`. */
  search(query: SearchQuery, limit: number): Promise<LookupSearchResult[]>;
  /** Resolves once every background refresh in flight has settled (shutdown, tests). */
  idle(): Promise<void>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LookupServiceOptions {
  providers: LookupProvider[];
  /**
   * Persistent catalogue. Without one the service still coalesces
   * concurrent calls but asks the providers on every request.
   */
  catalog?: CatalogBookRepository;
  /** Age past which a stored hit is refreshed in the background. */
  refreshMs?: number;
  /** How long a miss is remembered before the providers are asked again. */
  missMs?: number;
  fetch?: FetchLike;
  timeoutMs?: number;
  /** In-memory TTL for free-text search results. */
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  now?: () => number;
  log?: (message: string) => void;
}

export function createLookupService({
  providers,
  catalog,
  refreshMs = 180 * DAY_MS,
  missMs = 7 * DAY_MS,
  fetch = (input, init) => globalThis.fetch(input, init),
  timeoutMs = 8_000,
  cacheTtlMs = 24 * 60 * 60 * 1000,
  cacheMaxEntries = 1000,
  now = Date.now,
  log = (message) => console.warn(`[lookup] ${message}`),
}: LookupServiceOptions): LookupService {
  const ctx: ProviderContext = { fetch, timeoutMs };
  const searchCache = new TtlCache<LookupSearchResult[]>({
    ttlMs: cacheTtlMs,
    maxEntries: cacheMaxEntries,
    now,
  });
  // Coalesce concurrent identical requests (double taps, two phones scanning
  // the same book, retries) into one provider round-trip.
  const inflight = new Map<string, Promise<unknown>>();
  // Background refreshes of stale rows, one per ISBN.
  const refreshing = new Map<string, Promise<void>>();

  const iso = () => new Date(now()).toISOString();
  const ageMs = (timestamp: string) => now() - Date.parse(timestamp);

  function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
    const pending = inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    const promise = run().finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  const asProviderError = (provider: LookupProvider, error: unknown) =>
    error instanceof ProviderError
      ? error
      : new ProviderError(provider.name, error instanceof Error ? error.message : 'failed');

  async function firstResult<T>(
    attempt: (provider: LookupProvider) => Promise<T | null>,
  ): Promise<T | null> {
    const failures: ProviderError[] = [];
    for (const provider of providers) {
      try {
        const result = await attempt(provider);
        if (result !== null) return result;
      } catch (error) {
        const failure = asProviderError(provider, error);
        failures.push(failure);
        log(failure.message);
      }
    }
    if (failures.length > 0 && failures.length === providers.length) {
      throw new LookupUnavailableError(failures);
    }
    return null;
  }

  /** Ask every provider at once; a failed one contributes nothing, all failing is an error. */
  async function allResults(query: SearchQuery, limit: number): Promise<BookDraft[][]> {
    const settled = await Promise.allSettled(
      providers.map((provider) => provider.search(query, limit, ctx)),
    );
    const failures: ProviderError[] = [];
    const results = settled.map((outcome, index) => {
      if (outcome.status === 'fulfilled') return outcome.value;
      const failure = asProviderError(providers[index]!, outcome.reason);
      failures.push(failure);
      log(failure.message);
      return [];
    });
    if (failures.length > 0 && failures.length === providers.length) {
      throw new LookupUnavailableError(failures);
    }
    return results;
  }

  const fetchIsbn = (isbn13: string) =>
    dedupe(`isbn:${isbn13}`, () => firstResult((provider) => provider.byIsbn(isbn13, ctx)));

  /** Ask the providers and record the answer (hit or miss) in the catalogue. */
  async function fetchAndStore(isbn13: string): Promise<BookDraft | null> {
    const draft = await fetchIsbn(isbn13);
    if (catalog) {
      const at = iso();
      const row = draft
        ? hitRow(isbn13, draft, { fetchedAt: at, refreshedAt: at })
        : missRow(isbn13, {
            fetchedAt: at,
            refreshedAt: at,
            missUntil: new Date(now() + missMs).toISOString(),
          });
      await catalog.save(row);
    }
    return draft;
  }

  /**
   * Stale-while-revalidate: refresh a row after serving it. A provider
   * failure keeps the row as it was; a provider that no longer knows the
   * ISBN keeps the metadata too (it was good once) and only bumps the clock.
   */
  function refreshInBackground(isbn13: string): void {
    if (!catalog || refreshing.has(isbn13)) return;
    const store = catalog;
    const task = (async () => {
      try {
        const draft = await fetchIsbn(isbn13);
        const at = iso();
        if (draft) await store.save(hitRow(isbn13, draft, { fetchedAt: at, refreshedAt: at }));
        else await store.markRefreshed(isbn13, at);
      } catch (error) {
        log(`refresh of ${isbn13} failed: ${error instanceof Error ? error.message : 'error'}`);
      }
    })().finally(() => refreshing.delete(isbn13));
    refreshing.set(isbn13, task);
  }

  /** Remember search results that carry an ISBN, without downgrading a full record. */
  async function storeSearchResults(items: BookDraft[]): Promise<void> {
    if (!catalog) return;
    const at = iso();
    for (const item of items) {
      if (!item.isbn13) continue;
      try {
        await catalog.saveIfUnknown(hitRow(item.isbn13, item, { fetchedAt: at, refreshedAt: at }));
      } catch (error) {
        log(`could not store ${item.isbn13}: ${error instanceof Error ? error.message : 'error'}`);
      }
    }
  }

  return {
    async byIsbn(isbn13) {
      const known = catalog ? await catalog.find(isbn13) : null;
      if (known?.draft) {
        if (ageMs(known.refreshedAt) >= refreshMs) refreshInBackground(isbn13);
        return known.draft;
      }
      if (known?.missUntil && Date.parse(known.missUntil) > now()) return null;
      return dedupe(`store:${isbn13}`, () => fetchAndStore(isbn13));
    },

    search(query, limit) {
      const normalized = normalizeQuery(query);
      const key = `${limit}:${JSON.stringify(normalized)}`;
      const cached = searchCache.get(key);
      if (cached !== undefined) return Promise.resolve(cached);
      return dedupe(`search:${key}`, async () => {
        const items = mergeResults(await allResults(normalized, limit), normalized, limit);
        searchCache.set(key, items);
        await storeSearchResults(items);
        return items;
      });
    },

    async idle() {
      while (refreshing.size > 0) await Promise.allSettled([...refreshing.values()]);
    },
  };
}

/** Same search, same key: text fields lower-cased and single-spaced, blanks dropped, stable field order. */
export function normalizeQuery(query: SearchQuery): SearchQuery {
  const clean = (value: string | undefined) => {
    const text = value?.trim().replace(/\s+/g, ' ').toLowerCase();
    return text === '' ? undefined : text;
  };
  const normalized: SearchQuery = {};
  const q = clean(query.q);
  const title = clean(query.title);
  const author = clean(query.author);
  const publisher = clean(query.publisher);
  if (q) normalized.q = q;
  if (title) normalized.title = title;
  if (author) normalized.author = author;
  if (query.isbn13) normalized.isbn13 = query.isbn13;
  if (publisher) normalized.publisher = publisher;
  if (query.year) normalized.year = query.year;
  return normalized;
}

export interface DefaultLookupConfig {
  openLibraryUrl: string;
  googleBooksUrl: string;
  googleBooksApiKey?: string;
  cacheTtlMs: number;
  timeoutMs: number;
  catalogRefreshMs: number;
  catalogMissMs: number;
}

/** The production wiring: catalogue → Open Library → Google Books, global fetch. */
export function createDefaultLookupService(
  config: DefaultLookupConfig,
  catalog: CatalogBookRepository,
): LookupService {
  return createLookupService({
    providers: [
      openLibraryProvider({ baseUrl: config.openLibraryUrl }),
      googleBooksProvider({ baseUrl: config.googleBooksUrl, apiKey: config.googleBooksApiKey }),
    ],
    catalog,
    refreshMs: config.catalogRefreshMs,
    missMs: config.catalogMissMs,
    cacheTtlMs: config.cacheTtlMs,
    timeoutMs: config.timeoutMs,
  });
}
