/**
 * Library statistics: every number the Stats tab shows, computed by the
 * database (grouped counts through the adapter kit) and only shaped here —
 * sorted, capped at the top N with the tail folded into "other", and
 * zero-filled over the last `STATS_MONTHS` months.
 */
import {
  localDate,
  STATS_MONTHS,
  STATS_TOP_N,
  type Stats,
  type StatsBucket,
} from '@bookguardian/shared';
import type { GroupCount } from './db/adapters/types';
import type { Repositories } from './db/repositories';

export interface StatsOptions {
  /** The month the timeline ends with; defaults to the server's current month. */
  now?: Date;
}

const byCountDesc = (a: GroupCount, b: GroupCount) =>
  b.count - a.count || a.key.localeCompare(b.key);

/** Largest first; past `STATS_TOP_N` the remaining buckets add up to `other`. */
export function topN(groups: GroupCount[], n = STATS_TOP_N): { top: StatsBucket[]; other: number } {
  const sorted = [...groups].sort(byCountDesc);
  return {
    top: sorted.slice(0, n),
    other: sorted.slice(n).reduce((sum, g) => sum + g.count, 0),
  };
}

/** `YYYY-MM` for `months` months before the month of `now` (0 = that month). */
export function monthKey(now: Date, monthsBack: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  return localDate(d).slice(0, 7);
}

/** The last `count` months ending with the month of `now`, oldest first. */
export function lastMonths(now: Date, count = STATS_MONTHS): string[] {
  return Array.from({ length: count }, (_, i) => monthKey(now, count - 1 - i));
}

export async function computeStats(
  repos: Repositories,
  ownerId: string,
  { now = new Date() }: StatsOptions = {},
): Promise<Stats> {
  const months = lastMonths(now);
  const [
    libraries,
    shelves,
    perShelf,
    perStatus,
    perRating,
    perLanguage,
    perPublisher,
    perCategory,
    perAuthor,
    perMonth,
    perYear,
    pages,
    lent,
  ] = await Promise.all([
    repos.libraries.listByOwner(ownerId),
    repos.shelves.listByOwner(ownerId),
    repos.books.countByShelf(ownerId),
    repos.books.countByReadStatus(ownerId),
    repos.books.countByRating(ownerId),
    repos.books.countByLanguage(ownerId),
    repos.books.countByPublisher(ownerId),
    repos.books.countByCategory(ownerId),
    repos.books.countByAuthor(ownerId),
    repos.books.countReadByMonth(ownerId, months[0]!),
    repos.books.countReadByYear(ownerId),
    repos.books.sumPages(ownerId),
    repos.lendings.countOpen(ownerId),
  ]);

  const libraryName = new Map(libraries.map((l) => [l.id, l.name]));
  const byShelf = shelves
    .map((shelf) => ({
      id: shelf.id,
      name: shelf.name,
      libraryId: shelf.libraryId,
      libraryName: libraryName.get(shelf.libraryId) ?? '',
      count: perShelf.get(shelf.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const perLibrary = new Map<string, number>();
  for (const shelf of byShelf) {
    perLibrary.set(shelf.libraryId, (perLibrary.get(shelf.libraryId) ?? 0) + shelf.count);
  }
  const byLibrary = libraries
    .map((l) => ({ id: l.id, name: l.name, count: perLibrary.get(l.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const byReadStatus = {
    to_read: perStatus.get('to_read') ?? 0,
    reading: perStatus.get('reading') ?? 0,
    read: perStatus.get('read') ?? 0,
  };
  const byRating = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: perRating.get(rating) ?? 0,
  }));
  const monthCount = new Map(perMonth.map((g) => [g.key, g.count]));

  return {
    totals: {
      books: byReadStatus.to_read + byReadStatus.reading + byReadStatus.read,
      read: byReadStatus.read,
      reading: byReadStatus.reading,
      toRead: byReadStatus.to_read,
      lent,
      rated: byRating.reduce((sum, r) => sum + r.count, 0),
      pages,
    },
    byLibrary,
    byShelf,
    byReadStatus,
    byCategory: topN(perCategory),
    byLanguage: topN(perLanguage),
    byRating,
    readByMonth: months.map((month) => ({ month, count: monthCount.get(month) ?? 0 })),
    readByYear: perYear
      .map((g) => ({ year: g.key, count: g.count }))
      .sort((a, b) => a.year.localeCompare(b.year)),
    topAuthors: topN(perAuthor),
    topPublishers: topN(perPublisher),
  };
}
