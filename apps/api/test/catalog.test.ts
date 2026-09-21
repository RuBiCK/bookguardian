/**
 * Shared ISBN catalogue: the `BookDraft` ↔ `catalog_books` mapping, the
 * repository, and the DB-first lookup service on top of it.
 */
import type { BookDraft } from '@bookguardian/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Repositories } from '../src/db/repositories';
import { createRepositories } from '../src/db/repositories';
import { fromRow, hitRow, missRow } from '../src/db/repositories/catalog-books';
import { LookupUnavailableError } from '../src/lookup';
import { createTestDb, type TestDb } from './adapters';
import { fixtureFetch, fixtureLookup, OPEN_LIBRARY } from './lookup-fixtures';

const DUNE: BookDraft = {
  isbn10: '0441172717',
  isbn13: '9780441172719',
  title: 'Dune',
  subtitle: null,
  authors: ['Frank Herbert'],
  publisher: 'Ace Books',
  publishedDate: '1990',
  pages: 535,
  language: 'en',
  coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
  categories: ['Science fiction'],
  description: 'Arrakis.',
  source: 'open_library',
  sourceId: '/books/OL1M',
};

const T0 = Date.parse('2026-09-19T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => new Date(ms).toISOString();

describe('catalog row mapping', () => {
  it('maps a hit to a row and back without loss', () => {
    const row = hitRow('9780441172719', DUNE, { fetchedAt: at(T0), refreshedAt: at(T0) });
    expect(row).toMatchObject({
      isbn13: '9780441172719',
      isbn10: '0441172717',
      title: 'Dune',
      authors: ['Frank Herbert'],
      source: 'open_library',
      providerIds: { open_library: '/books/OL1M' },
      missUntil: null,
    });
    expect(JSON.parse(row.raw!)).toEqual(DUNE);
    const entry = fromRow(row);
    expect(entry.draft).toEqual(DUNE);
    expect(entry).toMatchObject({ source: 'open_library', fetchedAt: at(T0), missUntil: null });
  });

  it('keys 979 ISBNs with isbn10 = null and derives isbn10 from the requested ISBN', () => {
    const draft: BookDraft = { ...DUNE, isbn10: null, isbn13: '9791234567896', sourceId: null };
    const row = hitRow('9791234567896', draft, { fetchedAt: at(T0), refreshedAt: at(T0) });
    expect(row.isbn10).toBeNull();
    expect(row.providerIds).toEqual({});
    expect(fromRow(row).draft).toMatchObject({
      isbn13: '9791234567896',
      isbn10: null,
      sourceId: null,
    });

    // A provider that lists a sibling edition first does not move the row.
    const sibling = hitRow(
      '9780441172719',
      { ...DUNE, isbn13: '9780441013593', isbn10: '0441013597' },
      { fetchedAt: at(T0), refreshedAt: at(T0) },
    );
    expect(sibling).toMatchObject({ isbn13: '9780441172719', isbn10: '0441172717' });
    expect(fromRow(sibling).draft).toMatchObject({ isbn13: '9780441172719', isbn10: '0441172717' });
  });

  it('accumulates provider ids across sources', () => {
    const google: BookDraft = { ...DUNE, source: 'google_books', sourceId: 'B1hSG45JCX4C' };
    const row = hitRow(
      '9780441172719',
      google,
      { fetchedAt: at(T0), refreshedAt: at(T0) },
      { open_library: '/books/OL1M' },
    );
    expect(row.providerIds).toEqual({ open_library: '/books/OL1M', google_books: 'B1hSG45JCX4C' });
    expect(fromRow(row).draft?.sourceId).toBe('B1hSG45JCX4C');
  });

  it('represents a miss as a row without metadata', () => {
    const row = missRow('9780000000002', {
      fetchedAt: at(T0),
      refreshedAt: at(T0),
      missUntil: at(T0 + 7 * DAY),
    });
    expect(row).toMatchObject({
      isbn10: '0000000000',
      title: null,
      authors: [],
      categories: [],
      source: null,
      providerIds: {},
      raw: null,
      missUntil: at(T0 + 7 * DAY),
    });
    const entry = fromRow(row);
    expect(entry.draft).toBeNull();
    expect(entry.source).toBeNull();
  });

  it('treats a row with an unknown source as a miss rather than crashing', () => {
    const row = hitRow('9780441172719', DUNE, { fetchedAt: at(T0), refreshedAt: at(T0) });
    expect(fromRow({ ...row, source: 'amazon' }).draft).toBeNull();
  });
});

describe('catalog repository', () => {
  let db: TestDb;
  let repos: Repositories;
  beforeEach(async () => {
    db = await createTestDb();
    repos = createRepositories(db.adapter);
  });
  afterEach(async () => {
    await db.cleanup();
  });

  it('saves, finds, counts and keeps the first fetchedAt on overwrite', async () => {
    const { catalogBooks } = repos;
    expect(await catalogBooks.find('9780441172719')).toBeNull();
    await catalogBooks.save(
      hitRow('9780441172719', DUNE, { fetchedAt: at(T0), refreshedAt: at(T0) }),
    );
    expect(await catalogBooks.count()).toBe(1);

    const later = { fetchedAt: at(T0 + DAY), refreshedAt: at(T0 + DAY) };
    const google: BookDraft = { ...DUNE, source: 'google_books', sourceId: 'vol1', pages: 600 };
    const saved = await catalogBooks.save(hitRow('9780441172719', google, later));
    expect(saved).toMatchObject({
      fetchedAt: at(T0),
      refreshedAt: at(T0 + DAY),
      providerIds: { open_library: '/books/OL1M', google_books: 'vol1' },
    });
    const found = await catalogBooks.find('9780441172719');
    expect(found?.draft).toMatchObject({ source: 'google_books', pages: 600, sourceId: 'vol1' });
    expect(await catalogBooks.count()).toBe(1);
  });

  it('saveIfUnknown fills gaps and upgrades misses but never downgrades a record', async () => {
    const { catalogBooks } = repos;
    const stamp = { fetchedAt: at(T0), refreshedAt: at(T0) };
    const partial: BookDraft = { ...DUNE, description: null, pages: null };

    expect(await catalogBooks.saveIfUnknown(hitRow('9780441172719', partial, stamp))).toBe(true);
    expect(await catalogBooks.saveIfUnknown(hitRow('9780441172719', DUNE, stamp))).toBe(false);
    expect((await catalogBooks.find('9780441172719'))?.draft?.pages).toBeNull();

    await catalogBooks.save(missRow('9780441013593', { ...stamp, missUntil: at(T0 + DAY) }));
    expect(await catalogBooks.saveIfUnknown(hitRow('9780441013593', DUNE, stamp))).toBe(true);
    expect((await catalogBooks.find('9780441013593'))?.draft?.title).toBe('Dune');
  });

  it('markRefreshed only touches the clock', async () => {
    const { catalogBooks } = repos;
    await catalogBooks.save(
      hitRow('9780441172719', DUNE, { fetchedAt: at(T0), refreshedAt: at(T0) }),
    );
    await catalogBooks.markRefreshed('9780441172719', at(T0 + DAY));
    const found = await catalogBooks.find('9780441172719');
    expect(found).toMatchObject({ fetchedAt: at(T0), refreshedAt: at(T0 + DAY) });
    expect(found?.draft).toEqual(DUNE);
  });

  it('survives losing an insert race for the same ISBN', async () => {
    const { catalogBooks } = repos;
    const stamp = { fetchedAt: at(T0), refreshedAt: at(T0) };
    // Two writers that both saw "no row" before inserting.
    await Promise.all([
      catalogBooks.save(hitRow('9780441172719', DUNE, stamp)),
      catalogBooks.save(hitRow('9780441172719', { ...DUNE, pages: 1 }, stamp)),
    ]);
    expect(await catalogBooks.count()).toBe(1);
    expect((await catalogBooks.find('9780441172719'))?.draft?.title).toBe('Dune');
  });
});

describe('DB-first lookup service', () => {
  let db: TestDb;
  let repos: Repositories;
  let nowMs: number;
  const clock = () => nowMs;
  const isbnCalls = (calls: string[]) =>
    calls.filter((c) => c.includes('/isbn/') || c.includes('isbn%3A')).length;

  beforeEach(async () => {
    db = await createTestDb();
    repos = createRepositories(db.adapter);
    nowMs = T0;
  });
  afterEach(async () => {
    await db.cleanup();
  });

  const lookup = (overrides: Parameters<typeof fixtureLookup>[0] = {}) =>
    fixtureLookup({ catalog: repos.catalogBooks, now: clock, ...overrides });

  it('fetches once, then serves from the catalogue — also for a new service instance', async () => {
    const a = lookup();
    const first = await a.service.byIsbn('9780441172719');
    expect(first).toMatchObject({ title: 'Dune', source: 'open_library' });
    expect(isbnCalls(a.fetch.calls)).toBe(1);
    expect(await a.service.byIsbn('9780441172719')).toEqual(first);
    expect(isbnCalls(a.fetch.calls)).toBe(1);

    // "Restart": a fresh service and fetch over the same database.
    const b = lookup();
    expect(await b.service.byIsbn('9780441172719')).toEqual(first);
    expect(b.fetch.calls).toEqual([]);
    expect(await repos.catalogBooks.count()).toBe(1);
  });

  it('remembers a miss until missUntil, then asks again', async () => {
    const { service, fetch } = lookup({ missMs: 7 * DAY });
    expect(await service.byIsbn('9780000000002')).toBeNull();
    const calls = fetch.calls.length;
    expect(calls).toBeGreaterThan(0);
    expect(await repos.catalogBooks.find('9780000000002')).toMatchObject({
      draft: null,
      missUntil: at(T0 + 7 * DAY),
    });

    nowMs = T0 + 6 * DAY;
    expect(await service.byIsbn('9780000000002')).toBeNull();
    expect(fetch.calls.length).toBe(calls);

    // The book appeared upstream in the meantime.
    nowMs = T0 + 7 * DAY;
    fetch.route((url) =>
      url.pathname === '/isbn/9780000000002.json'
        ? { status: 200, body: { title: 'Now published', isbn_13: ['9780000000002'] } }
        : undefined,
    );
    expect(await service.byIsbn('9780000000002')).toMatchObject({ title: 'Now published' });
    expect(fetch.calls.length).toBeGreaterThan(calls);
    expect(await repos.catalogBooks.find('9780000000002')).toMatchObject({
      missUntil: null,
      fetchedAt: at(T0),
      refreshedAt: at(T0 + 7 * DAY),
    });
  });

  it('serves stale rows immediately and refreshes them in the background', async () => {
    const { service, fetch } = lookup({ refreshMs: 180 * DAY });
    await service.byIsbn('9780441172719');
    expect(isbnCalls(fetch.calls)).toBe(1);

    nowMs = T0 + 181 * DAY;
    fetch.route((url) =>
      url.pathname === '/isbn/9780441172719.json'
        ? { status: 200, body: { title: 'Dune (refreshed)', isbn_13: ['9780441172719'] } }
        : undefined,
    );
    // Still the stored record, and the provider call happens after the reply.
    expect(await service.byIsbn('9780441172719')).toMatchObject({ title: 'Dune' });
    await service.idle();
    expect(isbnCalls(fetch.calls)).toBe(2);
    expect(await repos.catalogBooks.find('9780441172719')).toMatchObject({
      draft: expect.objectContaining({ title: 'Dune (refreshed)' }),
      fetchedAt: at(T0),
      refreshedAt: at(T0 + 181 * DAY),
    });
    expect(await service.byIsbn('9780441172719')).toMatchObject({ title: 'Dune (refreshed)' });
    expect(isbnCalls(fetch.calls)).toBe(2);
  });

  it('keeps a stale row intact when the refresh fails or comes back empty', async () => {
    const { service, fetch, log } = lookup({ refreshMs: DAY });
    await service.byIsbn('9780441172719');
    nowMs = T0 + 2 * DAY;

    fetch.route(() => ({ status: 500, body: {} }));
    expect(await service.byIsbn('9780441172719')).toMatchObject({ title: 'Dune' });
    await service.idle();
    expect(log.at(-1)).toMatch(/^refresh of 9780441172719 failed/);
    expect(await repos.catalogBooks.find('9780441172719')).toMatchObject({
      draft: expect.objectContaining({ title: 'Dune' }),
      refreshedAt: at(T0),
    });

    // Providers reachable but no longer know the ISBN: keep the data, bump the clock.
    fetch.route(() => ({ status: 404, body: {} }));
    expect(await service.byIsbn('9780441172719')).toMatchObject({ title: 'Dune' });
    await service.idle();
    expect(await repos.catalogBooks.find('9780441172719')).toMatchObject({
      draft: expect.objectContaining({ title: 'Dune' }),
      refreshedAt: at(T0 + 2 * DAY),
      missUntil: null,
    });
  });

  it('shares one provider call between concurrent lookups of the same ISBN', async () => {
    const { service, fetch } = lookup();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.byIsbn('9780441172719')),
    );
    expect(new Set(results.map((r) => r?.title))).toEqual(new Set(['Dune']));
    expect(isbnCalls(fetch.calls)).toBe(1);
    expect(await repos.catalogBooks.count()).toBe(1);
  });

  it('does not record anything when every provider is down', async () => {
    const { service, fetch } = lookup();
    fetch.route(() => ({ status: 503, body: {} }));
    await expect(service.byIsbn('9780441172719')).rejects.toBeInstanceOf(LookupUnavailableError);
    expect(await repos.catalogBooks.count()).toBe(0);
    await expect(service.byIsbn('9780441172719')).rejects.toBeInstanceOf(LookupUnavailableError);
  });

  it('stores search results opportunistically so a later ISBN lookup is free', async () => {
    const { service, fetch } = lookup();
    const items = await service.search({ q: 'dune' }, 5);
    const withIsbn = items.filter((i) => i.isbn13);
    expect(withIsbn.length).toBeGreaterThan(0);
    expect(await repos.catalogBooks.count()).toBe(withIsbn.length);

    const before = fetch.calls.length;
    const { resultId, ...target } = withIsbn[0]!;
    expect(resultId).toMatch(/^open_library:/);
    expect(await service.byIsbn(target.isbn13!)).toEqual(target);
    expect(fetch.calls.length).toBe(before);

    // A direct fetch later overwrites the thinner search record, never the reverse.
    const other = lookup();
    other.fetch.route((url) =>
      url.pathname === `/isbn/${target.isbn13}.json`
        ? { status: 200, body: { title: 'Full record', isbn_13: [target.isbn13] } }
        : undefined,
    );
    await repos.catalogBooks.save(
      hitRow(
        target.isbn13!,
        { ...target, title: 'Full record' },
        { fetchedAt: at(T0), refreshedAt: at(T0) },
      ),
    );
    await other.service.search({ q: 'dune' }, 5);
    expect((await repos.catalogBooks.find(target.isbn13!))?.draft?.title).toBe('Full record');
  });

  it('logs and carries on when storing a search result fails', async () => {
    const broken = {
      ...repos.catalogBooks,
      saveIfUnknown: () => Promise.reject(new Error('disk full')),
    };
    const { service, log } = fixtureLookup({ catalog: broken, now: clock, fetch: fixtureFetch() });
    expect((await service.search({ q: 'dune' }, 2)).length).toBe(2);
    expect(log[0]).toMatch(/^could not store \d{13}: disk full$/);
  });

  it('a lookup during a slow refresh shares the provider call', async () => {
    const { service, fetch } = lookup({ refreshMs: DAY });
    await service.byIsbn('9780441172719');
    nowMs = T0 + 2 * DAY;
    // Two stale reads back to back: one refresh, not two.
    await Promise.all([service.byIsbn('9780441172719'), service.byIsbn('9780441172719')]);
    await service.idle();
    expect(isbnCalls(fetch.calls)).toBe(2);
    expect(fetch.calls.filter((c) => c === `${OPEN_LIBRARY}/isbn/9780441172719.json`)).toHaveLength(
      2,
    );
  });
});
