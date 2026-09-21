import { describe, expect, it } from 'vitest';
import { bookListQuerySchema, STATS_MONTHS, STATS_TOP_N, statsSchema } from '../src';

const ID = '0f3e2b8a-7d3c-4b2f-9a11-6f5e4d3c2b1a';

const stats = {
  totals: { books: 3, read: 1, reading: 1, toRead: 1, lent: 1, rated: 2, pages: 600 },
  byLibrary: [{ id: ID, name: 'My Library', count: 3 }],
  byShelf: [{ id: ID, name: 'Default', libraryId: ID, libraryName: 'My Library', count: 3 }],
  byReadStatus: { to_read: 1, reading: 1, read: 1 },
  byCategory: { top: [{ key: 'Fiction', count: 2 }], other: 0 },
  byLanguage: { top: [{ key: 'en', count: 3 }], other: 0 },
  byRating: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: rating === 5 ? 2 : 0 })),
  readByMonth: [{ month: '2026-09', count: 1 }],
  readByYear: [{ year: '2026', count: 1 }],
  topAuthors: { top: [{ key: 'Frank Herbert', count: 2 }], other: 1 },
  topPublishers: { top: [], other: 0 },
};

describe('stats DTO', () => {
  it('accepts the API payload and pins the window and cap', () => {
    expect(statsSchema.parse(stats)).toEqual(stats);
    expect(STATS_MONTHS).toBe(24);
    expect(STATS_TOP_N).toBe(8);
  });

  it('rejects malformed buckets', () => {
    expect(statsSchema.safeParse({ ...stats, byRating: stats.byRating.slice(1) }).success).toBe(
      false,
    );
    expect(
      statsSchema.safeParse({ ...stats, readByMonth: [{ month: '2026-9', count: 1 }] }).success,
    ).toBe(false);
    expect(
      statsSchema.safeParse({ ...stats, readByYear: [{ year: '26', count: 1 }] }).success,
    ).toBe(false);
    expect(
      statsSchema.safeParse({ ...stats, totals: { ...stats.totals, books: -1 } }).success,
    ).toBe(false);
  });

  it('bookListQuery takes the drill-down filters the Stats tab links to', () => {
    expect(
      bookListQuerySchema.parse({
        rating: '4',
        category: ' Fantasy ',
        author: 'Neil Gaiman',
        language: 'en',
        publisher: 'Gollancz',
        readFrom: '2026-01-01',
        readTo: '2026-01-31',
      }),
    ).toMatchObject({
      rating: 4,
      category: 'Fantasy',
      author: 'Neil Gaiman',
      language: 'en',
      publisher: 'Gollancz',
      readFrom: '2026-01-01',
      readTo: '2026-01-31',
    });
    expect(bookListQuerySchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(bookListQuerySchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(bookListQuerySchema.safeParse({ author: '' }).success).toBe(false);
    expect(bookListQuerySchema.safeParse({ readFrom: '2026-1-1' }).success).toBe(false);
    expect(bookListQuerySchema.safeParse({ readTo: 'yesterday' }).success).toBe(false);
  });
});
