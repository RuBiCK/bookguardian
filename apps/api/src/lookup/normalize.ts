/**
 * Field-level clean-up shared by every provider so a `BookDraft` always
 * satisfies the shared schema regardless of how messy the source record is.
 */
import { bookDraftSchema, parseIsbn, type BookDraft } from '@bookguardian/shared';

/** ISO 639-2/B codes (as used by Open Library) → BCP-47 tags the app stores. */
const LANGUAGE_CODES: Record<string, string> = {
  eng: 'en',
  spa: 'es',
  fre: 'fr',
  ger: 'de',
  ita: 'it',
  por: 'pt',
  dut: 'nl',
  rus: 'ru',
  pol: 'pl',
  swe: 'sv',
  nor: 'no',
  dan: 'da',
  fin: 'fi',
  cat: 'ca',
  glg: 'gl',
  baq: 'eu',
  jpn: 'ja',
  chi: 'zh',
  kor: 'ko',
  ara: 'ar',
  tur: 'tr',
  gre: 'el',
  heb: 'he',
  cze: 'cs',
  hun: 'hu',
  rum: 'ro',
  ukr: 'uk',
  lat: 'la',
};

export function normalizeLanguage(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code
    .trim()
    .replace(/^\/languages\//, '')
    .toLowerCase();
  if (!trimmed) return null;
  return (LANGUAGE_CODES[trimmed] ?? trimmed).slice(0, 16);
}

export function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Multi-line text (descriptions): keep paragraphs, trim the rest. */
export function longText(value: unknown, max: number): string | null {
  const raw =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && 'value' in value
        ? value.value
        : null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.replace(/\r\n/g, '\n').trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function stringList(value: unknown, itemMax: number, limit = 10): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    const cleaned = text(item, itemMax);
    if (cleaned && !seen.has(cleaned)) seen.add(cleaned);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

export function positiveInt(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

/** First valid ISBN in a list of raw identifiers, as both forms. */
export function pickIsbn(values: unknown): { isbn10: string | null; isbn13: string | null } {
  if (Array.isArray(values)) {
    for (const raw of values) {
      if (typeof raw !== 'string') continue;
      const parsed = parseIsbn(raw);
      if (parsed) return parsed;
    }
  }
  return { isbn10: null, isbn13: null };
}

export function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim().replace(/^http:\/\//i, 'https://');
  return /^https:\/\/\S+$/.test(url) ? url.slice(0, 2048) : null;
}

/** Validate a normalised record; drops it (returns `null`) when the provider gave nothing usable. */
export function finalizeDraft(candidate: BookDraft): BookDraft | null {
  const parsed = bookDraftSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
