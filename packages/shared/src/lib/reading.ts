/**
 * Reading-life rules shared by the API (the source of truth on write) and the
 * web app (so optimistic updates predict exactly what the server will store).
 * Pure functions, no I/O.
 */
import type { ReadStatus } from '../schemas/book';

/** The two fields that describe where a book is in its reading life. */
export interface ReadingFields {
  readStatus: ReadStatus;
  /** YYYY-MM-DD, only meaningful once the book is `read`. */
  readAt: string | null;
}

/** What a client may send: any subset; `undefined` means "leave as is". */
export type ReadingPatch = Partial<ReadingFields>;

export type ReadingRuleError =
  /** A finished date was given while the status is not `read`. */
  'read_at_requires_read';

export type ReadingResult =
  { ok: true; value: ReadingFields } | { ok: false; error: ReadingRuleError };

/** A book that was never touched: to read, no date. */
export const UNREAD: ReadingFields = { readStatus: 'to_read', readAt: null };

/** Today's calendar date in the caller's timezone (the browser's for the web, the server's for the API). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Merge `patch` into `current` and apply the reading rules:
 *
 * - moving to `read` stamps `readAt` with `today` unless a date was given;
 * - moving away from `read` clears `readAt`;
 * - a `readAt` sent for a book that is not `read` is rejected rather than
 *   silently dropped.
 *
 * Pass `current = null` for a brand-new book (treated as {@link UNREAD}).
 */
export function applyReadingRules(
  current: ReadingFields | null,
  patch: ReadingPatch,
  today: string,
): ReadingResult {
  const base = current ?? UNREAD;
  const merged: ReadingFields = {
    readStatus: patch.readStatus ?? base.readStatus,
    readAt: patch.readAt === undefined ? base.readAt : patch.readAt,
  };
  const changed = merged.readStatus !== base.readStatus;

  if (merged.readStatus !== 'read') {
    if (patch.readAt) return { ok: false, error: 'read_at_requires_read' };
    merged.readAt = null;
  } else if (changed && !merged.readAt) {
    merged.readAt = today;
  }
  return { ok: true, value: merged };
}

/** Ratings are 1–5 stars; `0` (and `null`) mean "not rated" and are stored as `null`. */
export function normaliseRating(rating: number | null | undefined): number | null | undefined {
  if (rating === undefined) return undefined;
  return rating === null || rating === 0 ? null : rating;
}
