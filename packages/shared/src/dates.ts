/**
 * Calendar-date helpers for "day, no time" fields (`readAt`, `dueAt`). Values
 * are `YYYY-MM-DD` strings in the user's local timezone: no `Date` round trip,
 * so a day never shifts because of a UTC conversion.
 */

/** Today (or `now`) as `YYYY-MM-DD` in the local timezone. */
export function localDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whether a `YYYY-MM-DD` date lies after `today` (ISO dates sort lexically). */
export function isFutureDate(date: string, today: string = localDate()): boolean {
  return date > today;
}
