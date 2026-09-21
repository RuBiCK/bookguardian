import { z } from 'zod';
import { idSchema } from '../schemas/common';

/** How many months of "read per month" the API returns (the current month included). */
export const STATS_MONTHS = 24;
/** Breakdowns over free-text dimensions (categories, languages, authors, publishers) stop here. */
export const STATS_TOP_N = 8;

const countSchema = z.number().int().nonnegative();

/** One slice of a breakdown: the value shared by `count` books. */
export const statsBucketSchema = z.object({
  key: z.string(),
  count: countSchema,
});
export type StatsBucket = z.infer<typeof statsBucketSchema>;

export const libraryStatsSchema = z.object({
  id: idSchema,
  name: z.string(),
  count: countSchema,
});
export type LibraryStats = z.infer<typeof libraryStatsSchema>;

export const shelfStatsSchema = libraryStatsSchema.extend({
  libraryId: idSchema,
  libraryName: z.string(),
});
export type ShelfStats = z.infer<typeof shelfStatsSchema>;

/** Books finished in one calendar month (`YYYY-MM`). */
export const monthStatsSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  count: countSchema,
});
export type MonthStats = z.infer<typeof monthStatsSchema>;

export const yearStatsSchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  count: countSchema,
});
export type YearStats = z.infer<typeof yearStatsSchema>;

export const ratingStatsSchema = z.object({
  rating: z.number().int().min(1).max(5),
  count: countSchema,
});
export type RatingStats = z.infer<typeof ratingStatsSchema>;

/**
 * `GET /api/stats`: "how big is my library and what is in it", every number
 * scoped to the signed-in user and computed by the database.
 *
 * Breakdowns are sorted by count (largest first); the free-text ones are
 * capped at `STATS_TOP_N` buckets with the rest folded into `other`. Books
 * without a value for a dimension (no language, no categories…) are not in
 * that breakdown, so its counts need not add up to `totals.books` — except
 * `byReadStatus`, where every book has exactly one status.
 */
export const statsSchema = z.object({
  totals: z.object({
    books: countSchema,
    read: countSchema,
    reading: countSchema,
    toRead: countSchema,
    /** Books currently out (one open lending each). */
    lent: countSchema,
    rated: countSchema,
    /** Sum of `pages` over the books that have one. */
    pages: countSchema,
  }),
  byLibrary: z.array(libraryStatsSchema),
  byShelf: z.array(shelfStatsSchema),
  byReadStatus: z.object({
    to_read: countSchema,
    reading: countSchema,
    read: countSchema,
  }),
  byCategory: z.object({ top: z.array(statsBucketSchema), other: countSchema }),
  byLanguage: z.object({ top: z.array(statsBucketSchema), other: countSchema }),
  /** One entry per star (1–5), always five, in ascending order. */
  byRating: z.array(ratingStatsSchema).length(5),
  /** The last `STATS_MONTHS` months ending with the current one, oldest first, zero-filled. */
  readByMonth: z.array(monthStatsSchema),
  /** Every year with at least one finished book, oldest first. */
  readByYear: z.array(yearStatsSchema),
  topAuthors: z.object({ top: z.array(statsBucketSchema), other: countSchema }),
  topPublishers: z.object({ top: z.array(statsBucketSchema), other: countSchema }),
});
export type Stats = z.infer<typeof statsSchema>;
