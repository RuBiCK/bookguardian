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

/** Strip separators from a typed ISBN; returns `{ isbn10 }`, `{ isbn13 }` or `null` when malformed. */
export function parseIsbn(
  raw: string,
): { isbn10: string; isbn13: null } | { isbn10: null; isbn13: string } | 'invalid' | null {
  const digits = raw.replace(/[\s-]/g, '').toUpperCase();
  if (digits === '') return null;
  if (/^[0-9]{9}[0-9X]$/.test(digits)) return { isbn10: digits, isbn13: null };
  if (/^97[89][0-9]{10}$/.test(digits)) return { isbn10: null, isbn13: digits };
  return 'invalid';
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
