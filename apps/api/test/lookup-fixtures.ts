/**
 * Recorded provider replies for lookup tests. `fixtureFetch` answers known
 * URLs from `test/fixtures/lookup/*.json` and 404s everything else, so the
 * providers are exercised end-to-end without touching the network.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLookupService, googleBooksProvider, openLibraryProvider } from '../src/lookup';
import type { FetchLike } from '../src/lookup';

export const OPEN_LIBRARY = 'https://openlibrary.test';
export const GOOGLE_BOOKS = 'https://books.test/v1';

const dir = join(import.meta.dirname, 'fixtures', 'lookup');
export const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));

/** Google's documented volume shape, hand-written (anonymous quota was exhausted while recording). */
export const GOOGLE_DUNE = {
  kind: 'books#volumes',
  totalItems: 1,
  items: [
    {
      kind: 'books#volume',
      id: 'B1hSG45JCX4C',
      volumeInfo: {
        title: 'Dune',
        subtitle: 'Deluxe Edition',
        authors: ['Frank Herbert'],
        publisher: 'Penguin',
        publishedDate: '2005-08-02',
        description: 'Set on the desert planet Arrakis…',
        industryIdentifiers: [
          { type: 'ISBN_13', identifier: '9780441013593' },
          { type: 'ISBN_10', identifier: '0441013597' },
        ],
        pageCount: 544,
        categories: ['Fiction', 'Fiction / Science Fiction / General'],
        imageLinks: {
          smallThumbnail:
            'http://books.google.com/books/content?id=B1hSG45JCX4C&printsec=frontcover&img=1&zoom=5&edge=curl&source=gbs_api',
          thumbnail:
            'http://books.google.com/books/content?id=B1hSG45JCX4C&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
        },
        language: 'en',
      },
    },
  ],
};

export type Route = (url: URL) => { status: number; body?: unknown } | undefined;

export interface FixtureFetch {
  fetch: FetchLike;
  /** Every URL requested, in order. */
  calls: string[];
  /** Prepend a route; the first matching route answers. */
  route(fn: Route): void;
}

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export function fixtureFetch(): FixtureFetch {
  const calls: string[] = [];
  const routes: Route[] = [];

  const defaults: Route = (url) => {
    const at = `${url.origin}${url.pathname}`;
    if (at === `${OPEN_LIBRARY}/isbn/9780441172719.json`)
      return { status: 200, body: fixture('openlibrary-edition-9780441172719') };
    if (at === `${OPEN_LIBRARY}/authors/OL79034A.json`)
      return { status: 200, body: fixture('openlibrary-author-OL79034A') };
    if (at === `${OPEN_LIBRARY}/works/OL893414W.json`)
      return { status: 200, body: fixture('openlibrary-work-OL893414W') };
    if (at === `${OPEN_LIBRARY}/search.json` && url.searchParams.get('q')?.includes('dune'))
      return { status: 200, body: fixture('openlibrary-search-dune') };
    if (at === `${OPEN_LIBRARY}/search.json`) return { status: 200, body: { docs: [] } };
    if (at.startsWith(OPEN_LIBRARY)) return { status: 404, body: { error: 'notfound' } };
    if (at === `${GOOGLE_BOOKS}/volumes`) {
      const q = url.searchParams.get('q') ?? '';
      if (q === 'isbn:9780441013593' || q.includes('dune'))
        return { status: 200, body: GOOGLE_DUNE };
      return { status: 200, body: { kind: 'books#volumes', totalItems: 0 } };
    }
    return undefined;
  };

  return {
    calls,
    route: (fn) => routes.unshift(fn),
    fetch: async (input) => {
      const url = new URL(input);
      calls.push(url.toString());
      for (const route of [...routes, defaults]) {
        const hit = route(url);
        if (hit) return json(hit.body, hit.status);
      }
      return json({ error: 'unrouted' }, 404);
    },
  };
}

/** Open Library → Google Books over fixtures, no cache expiry during a test. */
export function fixtureLookup(overrides: { fetch?: FixtureFetch; apiKey?: string } = {}) {
  const fetch = overrides.fetch ?? fixtureFetch();
  const log: string[] = [];
  const service = createLookupService({
    providers: [
      openLibraryProvider({ baseUrl: OPEN_LIBRARY }),
      googleBooksProvider({ baseUrl: GOOGLE_BOOKS, apiKey: overrides.apiKey }),
    ],
    fetch: fetch.fetch,
    timeoutMs: 1000,
    log: (message) => log.push(message),
  });
  return { service, fetch, log };
}
