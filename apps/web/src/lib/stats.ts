/**
 * Pure helpers behind the Stats tab and the filtered book list it links to:
 * period bounds for the timeline, locale-aware names for months and language
 * tags, and the one-line description of an active drill-down filter.
 */
import type { ReadStatus } from '@bookguardian/shared';

/** The subset of `/books` search params a stats segment can set. */
export interface BookBrowseFilter {
  readStatus?: ReadStatus;
  category?: string;
  language?: string;
  author?: string;
  publisher?: string;
  rating?: number;
  readFrom?: string;
  readTo?: string;
}

/** First and last day of a `YYYY-MM` month, as inclusive `readFrom` / `readTo`. */
export function monthBounds(month: string): { readFrom: string; readTo: string } {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const lastDay = new Date(year, m, 0).getDate();
  return { readFrom: `${month}-01`, readTo: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/** First and last day of a `YYYY` year, as inclusive `readFrom` / `readTo`. */
export function yearBounds(year: string): { readFrom: string; readTo: string } {
  return { readFrom: `${year}-01-01`, readTo: `${year}-12-31` };
}

/** "Jan" / "January 2026" for a `YYYY-MM` key, in the given locale. */
export function monthLabel(month: string, locale?: string, style: 'short' | 'long' = 'short') {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const date = new Date(year, m - 1, 1);
  return new Intl.DateTimeFormat(
    locale,
    style === 'short' ? { month: 'short' } : { month: 'long', year: 'numeric' },
  ).format(date);
}

/** Human name of a BCP-47 tag ("es" → "Spanish"); the tag itself when unknown. */
export function languageName(tag: string, locale?: string): string {
  try {
    const name = new Intl.DisplayNames(locale, { type: 'language', fallback: 'none' }).of(tag);
    return name && name.toLowerCase() !== tag.toLowerCase() ? name : tag;
  } catch {
    return tag;
  }
}

/**
 * Which period a `readFrom` / `readTo` pair stands for: a whole month, a whole
 * year, or an arbitrary range (shown as its bounds).
 */
export function describePeriod(
  readFrom: string | undefined,
  readTo: string | undefined,
  locale?: string,
): string | undefined {
  if (!readFrom && !readTo) return undefined;
  if (readFrom && readTo) {
    const month = readFrom.slice(0, 7);
    const bounds = monthBounds(month);
    if (readFrom === bounds.readFrom && readTo === bounds.readTo) {
      return monthLabel(month, locale, 'long');
    }
    const year = readFrom.slice(0, 4);
    const yb = yearBounds(year);
    if (readFrom === yb.readFrom && readTo === yb.readTo) return year;
  }
  return `${readFrom ?? '…'} – ${readTo ?? '…'}`;
}

/** Whether any drill-down dimension (beyond status) narrows the list. */
export function hasBrowseFilter(filter: BookBrowseFilter): boolean {
  const { readStatus: _status, ...dimensions } = filter;
  return Object.values(dimensions).some((value) => value !== undefined);
}
