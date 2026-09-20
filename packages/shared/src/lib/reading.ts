/**
 * Reading-life rules shared by the API (the source of truth on write) and the
 * web app (so optimistic updates predict exactly what the server will store).
 * Pure functions, no I/O.
 */
import type { ReadStatus } from '../schemas/book';

/** The three fields that describe where a book is in its reading life. */
export interface ReadingFields {
  readStatus: ReadStatus;
  /** YYYY-MM-DD, only meaningful once the book is `reading` or `read`. */
  startedAt: string | null;
  /** YYYY-MM-DD, only meaningful once the book is `read`. */
  readAt: string | null;
}

/** What a client may send: any subset; `undefined` means "leave as is". */
export type ReadingPatch = Partial<ReadingFields>;

export type ReadingRuleError =
  /** A finished date was given while the status is not `read`. */
  | 'read_at_requires_read'
  /** A started date was given while the status is `to_read`. */
  | 'started_at_requires_started'
  /** The finished date is earlier than the started date. */
  | 'read_before_start';

export type ReadingResult =
  { ok: true; value: ReadingFields } | { ok: false; error: ReadingRuleError };

/** A book that was never touched: to read, no dates. */
export const UNREAD: ReadingFields = { readStatus: 'to_read', startedAt: null, readAt: null };

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
 * - moving to `reading` stamps `startedAt` with `today` unless given;
 * - moving back to `to_read` clears both dates, `reading` clears `readAt`;
 * - a date that contradicts the resulting status is rejected rather than
 *   silently dropped, and `readAt` can never precede `startedAt`.
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
    startedAt: patch.startedAt === undefined ? base.startedAt : patch.startedAt,
    readAt: patch.readAt === undefined ? base.readAt : patch.readAt,
  };
  const changed = merged.readStatus !== base.readStatus;

  if (merged.readStatus !== 'read') {
    if (patch.readAt) return { ok: false, error: 'read_at_requires_read' };
    merged.readAt = null;
  }
  if (merged.readStatus === 'to_read') {
    if (patch.startedAt) return { ok: false, error: 'started_at_requires_started' };
    merged.startedAt = null;
  }
  if (merged.readStatus === 'reading' && changed && !merged.startedAt) {
    merged.startedAt = today;
  }
  if (merged.readStatus === 'read' && changed && !merged.readAt) {
    merged.readAt = today;
  }
  if (merged.startedAt && merged.readAt && merged.readAt < merged.startedAt) {
    return { ok: false, error: 'read_before_start' };
  }
  return { ok: true, value: merged };
}

/** Ratings are 1–5 stars; `0` (and `null`) mean "not rated" and are stored as `null`. */
export function normaliseRating(rating: number | null | undefined): number | null | undefined {
  if (rating === undefined) return undefined;
  return rating === null || rating === 0 ? null : rating;
}
