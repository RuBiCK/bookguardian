import type { BookDraft } from '@bookguardian/shared';
import { describe, expect, it } from 'vitest';
import {
  createLookupService,
  googleBooksProvider,
  LookupUnavailableError,
  openLibraryProvider,
  ProviderError,
  TtlCache,
  type LookupProvider,
} from '../src/lookup';
import {
  finalizeDraft,
  httpsUrl,
  longText,
  normalizeLanguage,
  pickIsbn,
  positiveInt,
  stringList,
  text,
} from '../src/lookup/normalize';
import { fetchJson } from '../src/lookup/types';
import {
  fixture,
  fixtureFetch,
  fixtureLookup,
  GOOGLE_BOOKS,
  OPEN_LIBRARY,
} from './lookup-fixtures';

const ctxFor = (fetch: ReturnType<typeof fixtureFetch>) => ({
  fetch: fetch.fetch,
  timeoutMs: 1000,
});

describe('normalize helpers', () => {
  it('maps Open Library language keys to BCP-47 and keeps unknown codes', () => {
    expect(normalizeLanguage('/languages/eng')).toBe('en');
    expect(normalizeLanguage('SPA')).toBe('es');
    expect(normalizeLanguage('en')).toBe('en');
    expect(normalizeLanguage('xyz')).toBe('xyz');
    expect(normalizeLanguage('')).toBeNull();
    expect(normalizeLanguage('/languages/')).toBeNull();
    expect(normalizeLanguage(undefined)).toBeNull();
  });

  it('cleans text, long text, lists and numbers', () => {
    expect(text('  Dune \n Messiah ', 500)).toBe('Dune Messiah');
    expect(text('   ', 500)).toBeNull();
    expect(text(42, 500)).toBeNull();
    expect(text('x'.repeat(10), 4)).toBe('xxxx');
    expect(longText('a\r\n\r\nb ', 100)).toBe('a\n\nb');
    expect(longText({ type: '/type/text', value: ' v ' }, 100)).toBe('v');
    expect(longText({ value: 3 }, 100)).toBeNull();
    expect(longText('   ', 100)).toBeNull();
    expect(longText(null, 100)).toBeNull();
    expect(stringList(['a', ' a ', 'b', 1, ''], 10)).toEqual(['a', 'b']);
    expect(stringList(['a', 'b', 'c'], 10, 2)).toEqual(['a', 'b']);
    expect(stringList('nope', 10)).toEqual([]);
    expect(positiveInt(12)).toBe(12);
    expect(positiveInt('12')).toBe(12);
    expect(positiveInt(0)).toBeNull();
    expect(positiveInt(1.5)).toBeNull();
    expect(positiveInt(null)).toBeNull();
  });

  it('picks the first valid ISBN and upgrades URLs to https', () => {
    expect(pickIsbn(['junk', 7, '0441013597'])).toEqual({
      isbn10: '0441013597',
      isbn13: '9780441013593',
    });
    expect(pickIsbn(['0441013598'])).toEqual({ isbn10: null, isbn13: null });
    expect(pickIsbn(undefined)).toEqual({ isbn10: null, isbn13: null });
    expect(httpsUrl('http://x.test/a b')).toBeNull();
    expect(httpsUrl('http://x.test/a.jpg')).toBe('https://x.test/a.jpg');
    expect(httpsUrl(null)).toBeNull();
  });

  it('drops drafts that fail the shared schema', () => {
    const good: BookDraft = {
      isbn10: null,
      isbn13: null,
      title: 'T',
      subtitle: null,
      authors: [],
      publisher: null,
      publishedDate: null,
      pages: null,
      language: null,
      coverUrl: null,
      categories: [],
      description: null,
      source: 'open_library',
      sourceId: null,
    };
    expect(finalizeDraft(good)).toEqual(good);
    expect(finalizeDraft({ ...good, title: '' })).toBeNull();
  });
});

describe('fetchJson', () => {
  it('wraps network errors, non-2xx and invalid JSON in ProviderError', async () => {
    const ctx = { fetch: () => Promise.reject(new Error('boom')), timeoutMs: 10 };
    await expect(fetchJson(ctx, 'open_library', 'https://x')).rejects.toMatchObject({
      name: 'ProviderError',
      provider: 'open_library',
      message: 'open_library: boom',
    });
    const teapot = {
      fetch: () => Promise.resolve(new Response('', { status: 418 })),
      timeoutMs: 10,
    };
    await expect(fetchJson(teapot, 'google_books', 'https://x')).rejects.toMatchObject({
      status: 418,
    });
    const garbage = {
      fetch: () => Promise.resolve(new Response('{', { status: 200 })),
      timeoutMs: 10,
    };
    await expect(fetchJson(garbage, 'google_books', 'https://x')).rejects.toThrow(/invalid JSON/);
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- non-Error throws happen
    const weird = { fetch: () => Promise.reject('string'), timeoutMs: 10 };
    await expect(fetchJson(weird, 'google_books', 'https://x')).rejects.toThrow(/request failed/);
  });
});

describe('openLibraryProvider', () => {
  const provider = openLibraryProvider({ baseUrl: `${OPEN_LIBRARY}/` });

  it('normalises an edition + work + author into a BookDraft', async () => {
    const fetch = fixtureFetch();
    const draft = await provider.byIsbn('9780441172719', ctxFor(fetch));
    expect(draft).toEqual({
      isbn10: '0441172717',
      isbn13: '9780441172719',
      title: 'Dune',
      subtitle: null,
      authors: ['Frank Herbert'],
      publisher: 'Ace Books',
      publishedDate: '1987',
      pages: 535,
      language: 'en',
      coverUrl: 'https://covers.openlibrary.org/b/id/15166231-L.jpg',
      categories: [
        'Dune (Imaginary place)',
        'Fiction',
        'Fiction, science fiction, general',
        'Dune (imaginary place), fiction',
        'New York Times reviewed',
        'Science fiction',
        'Science-fiction',
        'American literature',
      ],
      description: expect.stringContaining('Set on the desert planet Arrakis'),
      source: 'open_library',
      sourceId: '/books/OL22597282M',
    });
    expect(fetch.calls).toEqual([
      `${OPEN_LIBRARY}/isbn/9780441172719.json`,
      `${OPEN_LIBRARY}/authors/OL79034A.json`,
      `${OPEN_LIBRARY}/works/OL893414W.json`,
    ]);
  });

  it('returns null for unknown ISBNs and survives missing author/work records', async () => {
    const fetch = fixtureFetch();
    expect(await provider.byIsbn('9780000000002', ctxFor(fetch))).toBeNull();

    fetch.route((url) =>
      url.pathname.startsWith('/authors/') || url.pathname.startsWith('/works/')
        ? { status: 500, body: {} }
        : undefined,
    );
    const draft = await provider.byIsbn('9780441172719', ctxFor(fetch));
    expect(draft).toMatchObject({ title: 'Dune', authors: [], categories: [], description: null });
  });

  it('tolerates sparse edition records', async () => {
    const fetch = fixtureFetch();
    fetch.route((url) =>
      url.pathname === '/isbn/9780000000002.json'
        ? {
            status: 200,
            body: {
              title: 'Sparse',
              authors: [{}, { key: '/authors/OL79034A' }],
              description: { type: '/type/text', value: 'Inline description' },
              subjects: ['Sparse things'],
              covers: [-1],
            },
          }
        : undefined,
    );
    const draft = await provider.byIsbn('9780000000002', ctxFor(fetch));
    expect(draft).toMatchObject({
      isbn13: '9780000000002',
      isbn10: '0000000000',
      authors: ['Frank Herbert'],
      description: 'Inline description',
      categories: ['Sparse things'],
      coverUrl: null,
      language: null,
      sourceId: null,
    });
    fetch.route((url) =>
      url.pathname === '/isbn/9780000000002.json'
        ? { status: 200, body: { title: '' } }
        : undefined,
    );
    expect(await provider.byIsbn('9780000000002', ctxFor(fetch))).toBeNull();
  });

  it('turns search docs into drafts using the preferred edition', async () => {
    const fetch = fixtureFetch();
    const results = await provider.search('dune frank herbert', 3, ctxFor(fetch));
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      isbn10: '0425038912',
      isbn13: '9780425038918',
      title: 'Dune',
      subtitle: null,
      authors: ['Frank Herbert'],
      publisher: 'Berkley',
      publishedDate: 'August 1, 1978',
      pages: 607,
      language: 'en',
      coverUrl: 'https://covers.openlibrary.org/b/id/9705237-L.jpg',
      categories: [
        'Dune (Imaginary place)',
        'Fiction',
        'Fiction, science fiction, general',
        'Dune (imaginary place), fiction',
        'New York Times reviewed',
        'Science fiction',
        'Science-fiction',
        'American literature',
      ],
      description: null,
      source: 'open_library',
      sourceId: '/books/OL7500941M',
    });
    expect(results[1]).toMatchObject({
      title: 'Dune Messiah',
      subtitle: 'Dune Chronicles, Book 2',
    });
    const url = new URL(fetch.calls[0]!);
    expect(url.searchParams.get('lang')).toBe('en');
    expect(url.searchParams.get('limit')).toBe('3');
    expect(url.searchParams.get('fields')).toContain('editions.isbn');
  });

  it('handles docs without editions and empty result sets', async () => {
    const fetch = fixtureFetch();
    fetch.route((url) =>
      url.pathname === '/search.json' && url.searchParams.get('q') === 'sparse'
        ? {
            status: 200,
            body: {
              docs: [
                { key: '/works/OL1W', title: 'Only a title', first_publish_year: 1999 },
                { key: '/works/OL2W' },
              ],
            },
          }
        : undefined,
    );
    const results = await provider.search('sparse', 5, ctxFor(fetch));
    expect(results).toEqual([
      expect.objectContaining({
        title: 'Only a title',
        publishedDate: '1999',
        isbn13: null,
        coverUrl: null,
        sourceId: '/works/OL1W',
      }),
    ]);
    expect(await provider.search('nothing', 5, ctxFor(fetch))).toEqual([]);
  });
});

describe('googleBooksProvider', () => {
  it('normalises volumes, cleans cover URLs and appends the API key', async () => {
    const provider = googleBooksProvider({ baseUrl: GOOGLE_BOOKS, apiKey: 'k3y' });
    const fetch = fixtureFetch();
    const draft = await provider.byIsbn('9780441013593', ctxFor(fetch));
    expect(draft).toEqual({
      isbn10: '0441013597',
      isbn13: '9780441013593',
      title: 'Dune',
      subtitle: 'Deluxe Edition',
      authors: ['Frank Herbert'],
      publisher: 'Penguin',
      publishedDate: '2005-08-02',
      pages: 544,
      language: 'en',
      coverUrl:
        'https://books.google.com/books/content?id=B1hSG45JCX4C&printsec=frontcover&img=1&zoom=1&source=gbs_api',
      categories: ['Fiction', 'Fiction / Science Fiction / General'],
      description: 'Set on the desert planet Arrakis…',
      source: 'google_books',
      sourceId: 'B1hSG45JCX4C',
    });
    const url = new URL(fetch.calls[0]!);
    expect(url.searchParams.get('q')).toBe('isbn:9780441013593');
    expect(url.searchParams.get('key')).toBe('k3y');
    expect(url.searchParams.get('printType')).toBe('books');

    const results = await provider.search('dune', 2, ctxFor(fetch));
    expect(results).toHaveLength(1);
    expect(await provider.search('nothing', 2, ctxFor(fetch))).toEqual([]);
    expect(await provider.byIsbn('9780000000002', ctxFor(fetch))).toBeNull();
  });

  it('keeps the requested ISBN when the volume lacks identifiers and skips untitled volumes', async () => {
    const provider = googleBooksProvider({ baseUrl: GOOGLE_BOOKS });
    const fetch = fixtureFetch();
    fetch.route((url) =>
      url.searchParams.get('q') === 'isbn:9780000000002'
        ? {
            status: 200,
            body: {
              items: [
                {
                  id: 'x',
                  volumeInfo: { title: 'No ids', imageLinks: { smallThumbnail: 'http://i/x' } },
                },
              ],
            },
          }
        : url.searchParams.get('q') === 'untitled'
          ? { status: 200, body: { items: [{ id: 'y', volumeInfo: {} }, { id: 'z' }] } }
          : undefined,
    );
    expect(await provider.byIsbn('9780000000002', ctxFor(fetch))).toMatchObject({
      isbn13: '9780000000002',
      isbn10: null,
      coverUrl: 'https://i/x',
    });
    expect(await provider.search('untitled', 5, ctxFor(fetch))).toEqual([]);
    expect(fetch.calls.every((c) => !c.includes('key='))).toBe(true);
  });

  it('propagates quota errors as ProviderError', async () => {
    const provider = googleBooksProvider({ baseUrl: GOOGLE_BOOKS });
    const fetch = fixtureFetch();
    fetch.route(() => ({ status: 429, body: fixture('google-quota-429') }));
    await expect(provider.byIsbn('9780441013593', ctxFor(fetch))).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});

describe('TtlCache', () => {
  it('expires entries, evicts the least recently used and reports size', () => {
    let now = 1000;
    const cache = new TtlCache<number>({ ttlMs: 100, maxEntries: 2, now: () => now });
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1); // touch a → b is now the oldest
    cache.set('c', 3);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
    expect(cache.size).toBe(2);
    now = 1101;
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(1);
    cache.set('a', 4);
    cache.delete('a');
    expect(cache.has('a')).toBe(false);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

describe('lookup service', () => {
  it('prefers Open Library and caches per ISBN', async () => {
    const { service, fetch } = fixtureLookup();
    const first = await service.byIsbn('9780441172719');
    expect(first).toMatchObject({ source: 'open_library', title: 'Dune' });
    const before = fetch.calls.length;
    expect(await service.byIsbn('9780441172719')).toEqual(first);
    expect(fetch.calls.length).toBe(before);
    expect(fetch.calls.some((c) => c.startsWith(GOOGLE_BOOKS))).toBe(false);
  });

  it('falls back to Google Books when Open Library has nothing, and caches misses', async () => {
    const { service, fetch } = fixtureLookup();
    const draft = await service.byIsbn('9780441013593');
    expect(draft).toMatchObject({ source: 'google_books', title: 'Dune' });
    expect(await service.byIsbn('9780000000002')).toBeNull();
    const before = fetch.calls.length;
    expect(await service.byIsbn('9780000000002')).toBeNull();
    expect(fetch.calls.length).toBe(before);
  });

  it('coalesces concurrent identical lookups', async () => {
    const { service, fetch } = fixtureLookup();
    const [a, b] = await Promise.all([
      service.byIsbn('9780441172719'),
      service.byIsbn('9780441172719'),
    ]);
    expect(a).toEqual(b);
    expect(fetch.calls.filter((c) => c.includes('/isbn/'))).toHaveLength(1);
  });

  it('degrades when one provider fails and throws when all do', async () => {
    const { service, fetch, log } = fixtureLookup();
    fetch.route((url) => (url.origin === OPEN_LIBRARY ? { status: 500, body: {} } : undefined));
    expect(await service.byIsbn('9780441013593')).toMatchObject({ source: 'google_books' });
    expect(log).toEqual(['open_library: HTTP 500']);

    fetch.route(() => ({ status: 503, body: {} }));
    await expect(service.byIsbn('9780000000002')).rejects.toBeInstanceOf(LookupUnavailableError);
    // A failure is never cached: the next call tries the network again.
    expect(await service.byIsbn('9780000000002').catch((e: unknown) => e)).toBeInstanceOf(
      LookupUnavailableError,
    );
  });

  it('wraps non-ProviderError throws from a provider', async () => {
    const broken: LookupProvider = {
      name: 'open_library',
      byIsbn: () => Promise.reject(new Error('kaboom')),
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- non-Error throws happen
      search: () => Promise.reject('nope'),
    };
    const log: string[] = [];
    const service = createLookupService({
      providers: [broken],
      fetch: () => Promise.reject(new Error('unused')),
      log: (m) => log.push(m),
    });
    await expect(service.byIsbn('9780441013593')).rejects.toMatchObject({
      causes: [expect.objectContaining({ message: 'open_library: kaboom' })],
    });
    await expect(service.search('x', 5)).rejects.toMatchObject({
      causes: [expect.objectContaining({ message: 'open_library: failed' })],
    });
    expect(log).toEqual(['open_library: kaboom', 'open_library: failed']);
  });

  it('searches with normalised, cached queries and falls back to Google', async () => {
    const { service, fetch } = fixtureLookup();
    const items = await service.search('  Dune   Frank Herbert ', 5);
    expect(items).toHaveLength(5);
    expect(new URL(fetch.calls[0]!).searchParams.get('q')).toBe('dune frank herbert');
    const before = fetch.calls.length;
    expect(await service.search('dune frank herbert', 5)).toEqual(items);
    expect(fetch.calls.length).toBe(before);
    // A different limit is a different cache key.
    expect(await service.search('dune frank herbert', 2)).toHaveLength(2);

    fetch.route((url) =>
      url.origin === OPEN_LIBRARY && url.pathname === '/search.json'
        ? { status: 200, body: { docs: [] } }
        : undefined,
    );
    const google = await service.search('dune messiah', 5);
    expect(google.map((d) => d.source)).toEqual(['google_books']);
    expect(await service.search('nothing at all', 5)).toEqual([]);
  });

  it('uses global fetch and console.warn by default', async () => {
    const service = createLookupService({
      providers: [openLibraryProvider({ baseUrl: 'http://127.0.0.1:9' })],
      timeoutMs: 200,
    });
    const warn = console.warn;
    const logged: string[] = [];
    console.warn = (m: string) => logged.push(m);
    try {
      await expect(service.byIsbn('9780441013593')).rejects.toBeInstanceOf(LookupUnavailableError);
    } finally {
      console.warn = warn;
    }
    expect(logged[0]).toMatch(/^\[lookup\] open_library:/);
  });
});
