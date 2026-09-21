import { localDate, statsSchema, type Book, type Stats } from '@bookguardian/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Repositories } from '../src/db/repositories';
import { computeStats, lastMonths, monthKey, topN } from '../src/stats';
import { createTestApp, json, OWNER_HEADER, type TestApp } from './app';

/** `YYYY-MM-DD` of the first day `monthsAgo` months before today (local). */
function monthAgo(monthsAgo: number): string {
  const d = new Date();
  return `${localDate(new Date(d.getFullYear(), d.getMonth() - monthsAgo, 1)).slice(0, 7)}-01`;
}

/**
 * A library with known counts, written straight through the repositories so
 * ids and dates are fixed — what the snapshot below is taken of.
 */
async function seedFixture(repos: Repositories, ownerId: string) {
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const home = await repos.libraries.create(ownerId, { id: id(1), name: 'Home' });
  const office = await repos.libraries.create(ownerId, { id: id(2), name: 'Office' });
  const novels = await repos.shelves.create(ownerId, {
    id: id(3),
    libraryId: home.id,
    name: 'Novels',
  });
  const essays = await repos.shelves.create(ownerId, {
    id: id(4),
    libraryId: home.id,
    name: 'Essays',
  });
  const desk = await repos.shelves.create(ownerId, {
    id: id(5),
    libraryId: office.id,
    name: 'Desk',
  });
  await repos.shelves.create(ownerId, { id: id(6), libraryId: office.id, name: 'Empty' });

  const books = [
    // Novels: three read, one being read.
    {
      shelfId: novels.id,
      title: 'Dune',
      authors: ['Frank Herbert'],
      publisher: 'Chilton',
      language: 'en',
      categories: ['Science fiction'],
      pages: 412,
      rating: 5,
      readStatus: 'read',
      readAt: '2026-08-14',
    },
    {
      shelfId: novels.id,
      title: 'Dune Messiah',
      authors: ['Frank Herbert'],
      publisher: 'Putnam',
      language: 'en',
      categories: ['Science fiction'],
      pages: 256,
      rating: 4,
      readStatus: 'read',
      readAt: '2026-08-30',
    },
    {
      shelfId: novels.id,
      title: 'Cien años de soledad',
      authors: ['Gabriel García Márquez'],
      publisher: 'Sudamericana',
      language: 'es',
      categories: ['Fiction', 'Magical realism'],
      pages: 471,
      rating: 5,
      readStatus: 'read',
      readAt: '2025-01-05',
    },
    {
      shelfId: novels.id,
      title: 'Neuromancer',
      authors: ['William Gibson'],
      publisher: 'Ace',
      language: 'en',
      categories: ['Science fiction', 'Cyberpunk'],
      pages: 271,
      rating: null,
      readStatus: 'reading',
      readAt: null,
    },
    // Essays: one read long ago (outside the 24-month window), one to read.
    {
      shelfId: essays.id,
      title: 'A Room of One’s Own',
      authors: ['Virginia Woolf'],
      publisher: 'Hogarth',
      language: 'en',
      categories: ['Essay'],
      pages: 172,
      rating: 4,
      readStatus: 'read',
      readAt: '2019-11-20',
    },
    {
      shelfId: essays.id,
      title: 'Ensayos',
      authors: ['Michel de Montaigne'],
      publisher: null,
      language: 'fr',
      categories: [],
      pages: null,
      rating: null,
      readStatus: 'to_read',
      readAt: null,
    },
    // Desk: two to read, one co-authored.
    {
      shelfId: desk.id,
      title: 'Good Omens',
      authors: ['Terry Pratchett', 'Neil Gaiman'],
      publisher: 'Gollancz',
      language: 'en',
      categories: ['Fantasy', 'Fiction'],
      pages: 288,
      rating: 3,
      readStatus: 'to_read',
      readAt: null,
    },
    {
      shelfId: desk.id,
      title: 'The Colour of Magic',
      authors: ['Terry Pratchett'],
      publisher: 'Colin Smythe',
      language: 'en',
      categories: ['Fantasy'],
      pages: 206,
      rating: null,
      readStatus: 'to_read',
      readAt: null,
    },
  ] as const;
  const created = [];
  for (const [i, book] of books.entries()) {
    created.push(
      await repos.books.create(ownerId, {
        id: id(10 + i),
        ...book,
        authors: [...book.authors],
        categories: [...book.categories],
      }),
    );
  }
  // Two books out, one already back.
  await repos.lendings.create(ownerId, { id: id(30), bookId: created[0]!.id, borrowerName: 'Ana' });
  await repos.lendings.create(ownerId, { id: id(31), bookId: created[6]!.id, borrowerName: 'Bo' });
  const back = await repos.lendings.create(ownerId, {
    id: id(32),
    bookId: created[1]!.id,
    borrowerName: 'Cy',
  });
  await repos.lendings.markReturned(ownerId, back.id, '2026-09-01T10:00:00.000Z');
  return { home, office, novels, essays, desk, books: created };
}

describe('stats helpers', () => {
  it('topN sorts by count, then key, and folds the tail into other', () => {
    const groups = [
      { key: 'b', count: 2 },
      { key: 'a', count: 2 },
      { key: 'c', count: 5 },
      { key: 'd', count: 1 },
    ];
    expect(topN(groups, 2)).toEqual({
      top: [
        { key: 'c', count: 5 },
        { key: 'a', count: 2 },
      ],
      other: 3,
    });
    expect(topN([], 2)).toEqual({ top: [], other: 0 });
  });

  it('lastMonths ends with the current month and spans year boundaries', () => {
    const now = new Date(2026, 1, 10); // February 2026
    expect(monthKey(now, 0)).toBe('2026-02');
    expect(monthKey(now, 2)).toBe('2025-12');
    expect(lastMonths(now, 3)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(lastMonths(now)).toHaveLength(24);
  });
});

describe('GET /api/stats', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(async () => {
    await t.cleanup();
  });

  it('is all zeros for a fresh install, with the default library and shelf listed', async () => {
    const res = await json<Stats>(t.app, 'GET', '/api/stats');
    expect(res.status).toBe(200);
    const stats = statsSchema.parse(res.body);
    expect(stats.totals).toEqual({
      books: 0,
      read: 0,
      reading: 0,
      toRead: 0,
      lent: 0,
      rated: 0,
      pages: 0,
    });
    expect(stats.byLibrary).toEqual([{ id: t.base.libraryId, name: 'My Library', count: 0 }]);
    expect(stats.byShelf).toEqual([
      {
        id: t.base.shelfId,
        libraryId: t.base.libraryId,
        libraryName: 'My Library',
        name: 'Default',
        count: 0,
      },
    ]);
    expect(stats.byReadStatus).toEqual({ to_read: 0, reading: 0, read: 0 });
    expect(stats.byRating.map((r) => r.count)).toEqual([0, 0, 0, 0, 0]);
    expect(stats.readByMonth).toHaveLength(24);
    expect(stats.readByMonth.at(-1)).toEqual({ month: localDate().slice(0, 7), count: 0 });
    expect(stats.readByMonth.every((m) => m.count === 0)).toBe(true);
    expect(stats.readByYear).toEqual([]);
    expect(stats.byCategory).toEqual({ top: [], other: 0 });
    expect(stats.topAuthors).toEqual({ top: [], other: 0 });
  });

  it('counts a seeded library: totals, breakdowns, timeline and lendings', async () => {
    const f = await seedFixture(t.repos, t.base.userId);
    const res = await json<Stats>(t.app, 'GET', '/api/stats');
    expect(res.status).toBe(200);
    const stats = statsSchema.parse(res.body);

    expect(stats.totals).toEqual({
      books: 8,
      read: 4,
      reading: 1,
      toRead: 3,
      lent: 2,
      rated: 5,
      pages: 412 + 256 + 471 + 271 + 172 + 288 + 206,
    });
    // Largest first; the seeded "My Library" is empty but still listed.
    expect(stats.byLibrary).toEqual([
      { id: f.home.id, name: 'Home', count: 6 },
      { id: f.office.id, name: 'Office', count: 2 },
      { id: t.base.libraryId, name: 'My Library', count: 0 },
    ]);
    expect(stats.byShelf.map((s) => [s.name, s.libraryName, s.count])).toEqual([
      ['Novels', 'Home', 4],
      ['Desk', 'Office', 2],
      ['Essays', 'Home', 2],
      ['Default', 'My Library', 0],
      ['Empty', 'Office', 0],
    ]);
    expect(stats.byReadStatus).toEqual({ to_read: 3, reading: 1, read: 4 });
    expect(stats.byRating).toEqual([
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 1 },
      { rating: 4, count: 2 },
      { rating: 5, count: 2 },
    ]);
    // A book counts once towards each of its categories / authors.
    expect(stats.byCategory).toEqual({
      top: [
        { key: 'Science fiction', count: 3 },
        { key: 'Fantasy', count: 2 },
        { key: 'Fiction', count: 2 },
        { key: 'Cyberpunk', count: 1 },
        { key: 'Essay', count: 1 },
        { key: 'Magical realism', count: 1 },
      ],
      other: 0,
    });
    expect(stats.topAuthors.top.slice(0, 2)).toEqual([
      { key: 'Frank Herbert', count: 2 },
      { key: 'Terry Pratchett', count: 2 },
    ]);
    expect(stats.byLanguage).toEqual({
      top: [
        { key: 'en', count: 6 },
        { key: 'es', count: 1 },
        { key: 'fr', count: 1 },
      ],
      other: 0,
    });
    // The book without a publisher is not a bucket.
    expect(stats.topPublishers.top.map((p) => p.key)).not.toContain('null');
    expect(stats.topPublishers.top.reduce((n, p) => n + p.count, 0)).toBe(7);
    // Timeline: 24 months ending now; 2019 is only in the per-year series.
    expect(stats.readByMonth).toHaveLength(24);
    const count = (month: string) => stats.readByMonth.find((m) => m.month === month)?.count;
    expect(count('2026-08')).toBe(2);
    expect(count('2025-01')).toBe(1);
    expect(stats.readByYear).toEqual([
      { year: '2019', count: 1 },
      { year: '2025', count: 1 },
      { year: '2026', count: 2 },
    ]);
  });

  it('folds breakdowns past the top 8 into "other"', async () => {
    for (let i = 0; i < 10; i += 1) {
      await json(t.app, 'POST', '/api/books', {
        title: `Book ${i}`,
        authors: [`Author ${i}`],
        categories: ['Common', `Niche ${i}`],
        language: `l${i}`,
      });
    }
    const { body } = await json<Stats>(t.app, 'GET', '/api/stats');
    expect(body.byCategory.top).toHaveLength(8);
    expect(body.byCategory.top[0]).toEqual({ key: 'Common', count: 10 });
    expect(body.byCategory.other).toBe(3);
    expect(body.topAuthors.top).toHaveLength(8);
    expect(body.topAuthors.other).toBe(2);
    expect(body.byLanguage.other).toBe(2);
  });

  it('only counts the caller’s books', async () => {
    await seedFixture(t.repos, t.base.userId);
    const other = await t.repos.users.create({ displayName: 'Other' });
    const res = await t.app.request('/api/stats', { headers: { [OWNER_HEADER]: other.id } });
    const stats = statsSchema.parse(await res.json());
    expect(stats.totals.books).toBe(0);
    expect(stats.byLibrary).toEqual([]);
    expect(stats.byCategory.top).toEqual([]);
  });

  it('follows reading and lending changes', async () => {
    const { body: book } = await json<Book>(t.app, 'POST', '/api/books', { title: 'Emma' });
    const before = (await json<Stats>(t.app, 'GET', '/api/stats')).body;
    expect(before.totals).toMatchObject({ books: 1, toRead: 1, read: 0, lent: 0 });

    await json(t.app, 'PATCH', `/api/books/${book.id}`, {
      readStatus: 'read',
      readAt: monthAgo(1),
      rating: 4,
    });
    await json(t.app, 'POST', '/api/lendings', { bookId: book.id, borrowerName: 'Ana' });
    const after = (await json<Stats>(t.app, 'GET', '/api/stats')).body;
    expect(after.totals).toMatchObject({ books: 1, toRead: 0, read: 1, lent: 1, rated: 1 });
    expect(after.readByMonth.at(-2)).toEqual({ month: monthAgo(1).slice(0, 7), count: 1 });
    expect(after.byRating[3]).toEqual({ rating: 4, count: 1 });
  });

  it('matches the snapshot for the fixture (fixed ids and clock)', async () => {
    const owner = await t.repos.users.create({ displayName: 'Snapshot' });
    await seedFixture(t.repos, owner.id);
    const stats = await computeStats(t.repos, owner.id, { now: new Date(2026, 8, 15) });
    expect(statsSchema.parse(stats)).toMatchSnapshot();
  });
});
