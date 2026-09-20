import { cleanIsbn, parseIsbn as parseSharedIsbn, type IsbnPair } from '@bookguardian/shared';

/** Split a comma-separated field into trimmed, non-empty, de-duplicated entries. */
export function splitList(value: string): string[] {
  const seen = new Set<string>();
  for (const part of value.split(',')) {
    const item = part.trim();
    if (item) seen.add(item);
  }
  return [...seen];
}

export function joinList(values: readonly string[]): string {
  return values.join(', ');
}

/**
 * Parse a typed ISBN into both forms (check digit verified); `null` for an
 * empty field, `'invalid'` for anything that is not a real ISBN.
 */
export function parseIsbn(raw: string): IsbnPair | 'invalid' | null {
  if (cleanIsbn(raw) === '') return null;
  return parseSharedIsbn(raw) ?? 'invalid';
}

/** Turn an empty/whitespace string into `null`, otherwise the trimmed value. */
export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Locale-aware short date for ISO timestamps or YYYY-MM-DD strings. */
export function formatDate(value: string, locale?: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

/** First letter of a person's name (what an avatar falls back to), `?` when there is none. */
export function initialOf(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  const char = [...first][0];
  return char ? char.toUpperCase() : '?';
}
