import type { BookDraft } from '@bookguardian/shared';
import { describe, expect, it } from 'vitest';
import {
  createLookupService,
  googleBooksProvider,
  LookupUnavailableError,
  mergeResults,
  normalizeQuery,
  openLibraryProvider,
  ProviderError,
  resultIdOf,
  score,
  TtlCache,
  type LookupProvider,
} from '../src/lookup';
import { volumesQuery } from '../src/lookup/google-books';
import { searchParams } from '../src/lookup/open-library';
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
    const results = await provider.search({ q: 'dune frank herbert' }, 3, ctxFor(fetch));
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
    const results = await provider.search({ q: 'sparse' }, 5, ctxFor(fetch));
    expect(results).toEqual([
      expect.objectContaining({
        title: 'Only a title',
        publishedDate: '1999',
        isbn13: null,
        coverUrl: null,
        sourceId: '/works/OL1W',
      }),
    ]);
    expect(await provider.search({ q: 'nothing' }, 5, ctxFor(fetch))).toEqual([]);
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

    const results = await provider.search({ q: 'dune' }, 2, ctxFor(fetch));
    expect(results).toHaveLength(1);
    expect(await provider.search({ q: 'nothing' }, 2, ctxFor(fetch))).toEqual([]);
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
    expect(await provider.search({ q: 'untitled' }, 5, ctxFor(fetch))).toEqual([]);
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
  it('prefers Open Library and asks the providers once per ISBN', async () => {
    const { service, fetch } = fixtureLookup();
    const first = await service.byIsbn('9780441172719');
    expect(first).toMatchObject({ source: 'open_library', title: 'Dune' });
    expect(fetch.calls.some((c) => c.startsWith(GOOGLE_BOOKS))).toBe(false);
    // Without a catalogue there is nothing to remember: every call fetches.
    const before = fetch.calls.length;
    expect(await service.byIsbn('9780441172719')).toEqual(first);
    expect(fetch.calls.length).toBe(before * 2);
  });

  it('falls back to Google Books when Open Library has nothing', async () => {
    const { service, fetch } = fixtureLookup();
    const draft = await service.byIsbn('9780441013593');
    expect(draft).toMatchObject({ source: 'google_books', title: 'Dune' });
    expect(fetch.calls[0]).toBe(`${OPEN_LIBRARY}/isbn/9780441013593.json`);
    expect(await service.byIsbn('9780000000002')).toBeNull();
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
    await expect(service.search({ q: 'x' }, 5)).rejects.toMatchObject({
      causes: [expect.objectContaining({ message: 'open_library: failed' })],
    });
    expect(log).toEqual(['open_library: kaboom', 'open_library: failed']);
  });

  it('searches with normalised, cached queries and falls back to Google', async () => {
    const { service, fetch } = fixtureLookup();
    const items = await service.search({ q: '  Dune   Frank Herbert ' }, 5);
    expect(items).toHaveLength(5);
    expect(new URL(fetch.calls[0]!).searchParams.get('q')).toBe('dune frank herbert');
    const before = fetch.calls.length;
    expect(await service.search({ q: 'dune frank herbert' }, 5)).toEqual(items);
    expect(fetch.calls.length).toBe(before);
    // A different limit is a different cache key.
    expect(await service.search({ q: 'dune frank herbert' }, 2)).toHaveLength(2);

    fetch.route((url) =>
      url.origin === OPEN_LIBRARY && url.pathname === '/search.json'
        ? { status: 200, body: { docs: [] } }
        : undefined,
    );
    const google = await service.search({ q: 'dune messiah' }, 5);
    expect(google.map((d) => d.source)).toEqual(['google_books']);
    expect(await service.search({ q: 'nothing at all' }, 5)).toEqual([]);
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

const DRAFT: BookDraft = {
  isbn10: '0441013597',
  isbn13: '9780441013593',
  title: 'Dune',
  subtitle: null,
  authors: ['Frank Herbert'],
  publisher: 'Ace Books',
  publishedDate: '2005',
  pages: 528,
  language: 'en',
  coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
  categories: ['Science fiction'],
  description: null,
  source: 'open_library',
  sourceId: '/books/OL1M',
};

describe('structured queries → provider requests', () => {
  it('maps fields onto Open Library search parameters', () => {
    const params = searchParams({
      q: 'dune',
      title: 'dune',
      author: 'frank herbert',
      isbn13: '9780441013593',
      publisher: 'ace',
      year: 1965,
    });
    expect(Object.fromEntries(params)).toEqual({
      q: 'dune first_publish_year:1965',
      title: 'dune',
      author: 'frank herbert',
      isbn: '9780441013593',
      publisher: 'ace',
    });
    expect(Object.fromEntries(searchParams({ year: 1965 }))).toEqual({
      q: 'first_publish_year:1965',
    });
    expect(Object.fromEntries(searchParams({ title: 'emma' }))).toEqual({ title: 'emma' });
  });

  it('maps fields onto Google Books operators and quotes phrases', () => {
    expect(
      volumesQuery({
        q: 'dune',
        title: 'dune  "messiah"',
        author: 'frank herbert',
        isbn13: '9780441013593',
        publisher: 'ace books',
      }),
    ).toBe(
      'dune intitle:"dune messiah" inauthor:"frank herbert" isbn:9780441013593 inpublisher:"ace books"',
    );
    // Google has no year field: a year alone means nothing to ask.
    expect(volumesQuery({ year: 1965 })).toBe('');
  });

  it('sends the structured request and skips Google when only a year is given', async () => {
    const fetch = fixtureFetch();
    const ol = openLibraryProvider({ baseUrl: OPEN_LIBRARY });
    const results = await ol.search({ title: 'dune', author: 'frank herbert' }, 5, ctxFor(fetch));
    expect(results.map((r) => r.isbn13)).toEqual(['9780441013593', '9780441172696']);
    const url = new URL(fetch.calls[0]!);
    expect(url.searchParams.get('title')).toBe('dune');
    expect(url.searchParams.get('author')).toBe('frank herbert');
    expect(url.searchParams.get('q')).toBeNull();

    const google = googleBooksProvider({ baseUrl: GOOGLE_BOOKS });
    expect(await google.search({ year: 1965 }, 5, ctxFor(fetch))).toEqual([]);
    expect(fetch.calls).toHaveLength(1);
    const hits = await google.search({ title: 'dune', author: 'frank herbert' }, 5, ctxFor(fetch));
    expect(hits.map((r) => r.isbn13)).toEqual(['9780441013593', '9780441104024']);
    expect(new URL(fetch.calls[1]!).searchParams.get('q')).toBe(
      'intitle:"dune" inauthor:"frank herbert"',
    );
  });
});

describe('merge and rank', () => {
  const google: BookDraft = {
    ...DRAFT,
    subtitle: 'Deluxe Edition',
    publisher: 'Penguin',
    description: 'Set on the desert planet Arrakis…',
    source: 'google_books',
    sourceId: 'B1hSG45JCX4C',
  };
  const messiah: BookDraft = {
    ...DRAFT,
    isbn10: '0441172695',
    isbn13: '9780441172696',
    title: 'Dune Messiah',
    sourceId: '/books/OL2M',
  };
  const untitled: BookDraft = { ...DRAFT, isbn10: null, isbn13: null, sourceId: null };

  it('scores exact ISBN, then title + author, then single-field matches', () => {
    expect(score(DRAFT, { isbn13: '9780441013593' })).toBe(100);
    expect(score(DRAFT, { isbn13: '9780441172696' })).toBe(0);
    expect(score(DRAFT, { title: 'DUNE', author: 'Herbert' })).toBe(20);
    expect(score(messiah, { title: 'dune messiah', author: 'frank' })).toBe(20);
    expect(score(DRAFT, { title: 'dune messiah' })).toBe(0);
    expect(score(DRAFT, { title: 'dune', author: 'asimov' })).toBe(10);
    expect(score(DRAFT, { author: 'hérbert', publisher: 'ace', year: 2005 })).toBe(13);
    expect(score(DRAFT, { q: 'anything' })).toBe(0);
  });

  it('deduplicates the same ISBN across providers, filling blanks from the second', () => {
    const merged = mergeResults([[DRAFT, messiah], [google]], { title: 'dune' }, 10);
    expect(merged.map((r) => r.resultId)).toEqual([
      'open_library:/books/OL1M',
      'open_library:/books/OL2M',
    ]);
    // Open Library's record wins, Google only fills what it lacked.
    expect(merged[0]).toMatchObject({
      source: 'open_library',
      publisher: 'Ace Books',
      subtitle: 'Deluxe Edition',
      description: 'Set on the desert planet Arrakis…',
    });
  });

  it('puts an exact ISBN match first, keeps provider order otherwise and caps at the limit', () => {
    const ranked = mergeResults(
      [
        [DRAFT, messiah],
        [google, untitled],
      ],
      {
        author: 'herbert',
        isbn13: '9780441172696',
      },
      10,
    );
    expect(ranked.map((r) => r.title)).toEqual(['Dune Messiah', 'Dune', 'Dune']);
    expect(mergeResults([[DRAFT, messiah], [untitled]], {}, 2).map((r) => r.title)).toEqual([
      'Dune',
      'Dune Messiah',
    ]);
  });

  it('derives a stable result id from the provider key, else the ISBN, else the text', () => {
    expect(resultIdOf(DRAFT)).toBe('open_library:/books/OL1M');
    expect(resultIdOf({ ...DRAFT, sourceId: null })).toBe('open_library:9780441013593');
    expect(resultIdOf(untitled)).toBe('open_library:dune frank herbert');
  });

  it('normalises a query for caching: trimmed, lower-cased, blanks dropped', () => {
    expect(
      normalizeQuery({
        q: '  Dune   Messiah ',
        title: '',
        author: ' Frank  HERBERT',
        isbn13: '9780441013593',
        publisher: '   ',
        year: 1969,
      }),
    ).toEqual({ q: 'dune messiah', author: 'frank herbert', isbn13: '9780441013593', year: 1969 });
    expect(normalizeQuery({})).toEqual({});
  });
});

describe('lookup service — structured search', () => {
  it('asks every provider at once and merges their answers by ISBN', async () => {
    const { service, fetch } = fixtureLookup();
    const items = await service.search({ title: ' Dune ', author: 'Frank Herbert' }, 5);
    expect(items.map((i) => [i.resultId, i.isbn13])).toEqual([
      ['open_library:/books/OL24347578M', '9780441013593'],
      ['open_library:/books/OL7500946M', '9780441172696'],
      ['google_books:Ez1sAAAAMAAJ', '9780441104024'],
    ]);
    // The duplicate Dune contributed what Open Library's record lacked.
    expect(items[0]).toMatchObject({
      source: 'open_library',
      publisher: 'Ace Books',
      description: 'Set on the desert planet Arrakis…',
    });
    const [ol, google] = fetch.calls.map((c) => new URL(c));
    expect(ol!.origin).toBe(OPEN_LIBRARY);
    expect(ol!.searchParams.get('title')).toBe('dune');
    expect(google!.pathname).toBe('/v1/volumes');
    expect(google!.searchParams.get('q')).toBe('intitle:"dune" inauthor:"frank herbert"');
    // Same query, different spacing/case: served from the cache.
    expect(await service.search({ title: 'dune', author: ' frank  herbert ' }, 5)).toEqual(items);
    expect(fetch.calls).toHaveLength(2);
  });

  it('ranks an exact ISBN match first whichever provider found it', async () => {
    const { service } = fixtureLookup();
    const items = await service.search({ author: 'Frank Herbert', isbn13: '9780441104024' }, 5);
    expect(items[0]).toMatchObject({ isbn13: '9780441104024', source: 'google_books' });
    expect(items).toHaveLength(3);
  });

  it('carries on when one provider fails a search and throws when both do', async () => {
    const { service, fetch, log } = fixtureLookup();
    fetch.route((url) =>
      url.origin === OPEN_LIBRARY && url.pathname === '/search.json'
        ? { status: 500, body: {} }
        : undefined,
    );
    const items = await service.search({ title: 'dune', author: 'herbert' }, 5);
    expect(items.map((i) => i.source)).toEqual(['google_books', 'google_books']);
    expect(log).toEqual(['open_library: HTTP 500']);

    fetch.route(() => ({ status: 503, body: {} }));
    await expect(service.search({ title: 'emma' }, 5)).rejects.toBeInstanceOf(
      LookupUnavailableError,
    );
  });
});
