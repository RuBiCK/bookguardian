/**
 * Turn raw OCR output from a book cover into a few search queries, best
 * guess first. Covers are noisy: blurbs, prices, "NEW YORK TIMES BESTSELLER",
 * barcodes read as digits. We keep the lines that look like a title or an
 * author name and combine the strongest ones.
 */
import { findIsbnInText } from '@bookguardian/shared';

/** Marketing boilerplate that never identifies a book. */
const NOISE = [
  /\bbest[\s-]?sell(?:er|ing)\b/i,
  /\bnew york times\b/i,
  /\ba novel\b/i,
  /\bnational book award\b/i,
  /\bwinner of\b/i,
  /\bauthor of\b/i,
  /\bintroduction by\b/i,
  /\btranslated by\b/i,
  /\bwith a new\b/i,
  /\bnow a major\b/i,
  /\bmillion copies\b/i,
  /\bpaperback|hardcover|edition\b/i,
  /\bisbn\b/i,
  /\bwww\.|\.com\b/i,
  /^[\s\d.,$€£:-]+$/,
];

const MIN_LETTERS = 3;
const MAX_QUERY_LENGTH = 120;

export interface OcrLine {
  text: string;
  score: number;
}

/** Collapse whitespace, strip decoration and anything that cannot be part of a title/name. */
export function cleanLine(raw: string): string {
  return raw
    .replace(/[|_~^<>{}\\[\]*#@=+]/g, ' ')
    .replace(/[“”"‘’`´]/g, '')
    .replace(/[^\p{L}\p{N}\s.,:;!?'&-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,:;!?'&-]+|[\s.,:;&-]+$/g, '')
    .trim();
}

function letters(value: string): number {
  return (value.match(/\p{L}/gu) ?? []).length;
}

/** How much a cleaned line looks like a title or author line (higher is better). */
export function scoreLine(line: string): number {
  const letterCount = letters(line);
  if (letterCount < MIN_LETTERS) return 0;
  if (NOISE.some((pattern) => pattern.test(line))) return 0;
  const words = line.split(' ').filter(Boolean);
  const nonAlpha = line.length - letterCount - (line.match(/\s/g) ?? []).length;
  // Garbage lines from OCR are full of stray punctuation and digits.
  if (nonAlpha / line.length > 0.35) return 0;
  // Single very short words ("THE", "BY") carry no signal on their own.
  if (words.length === 1 && letterCount < 4) return 0;
  const capitalised = words.filter((w) => /^\p{Lu}/u.test(w)).length;
  // Titles and names are short; length helps only up to a point.
  let score = Math.min(letterCount, 20);
  score += capitalised === words.length ? 8 : capitalised / words.length >= 0.5 ? 4 : 0;
  if (words.length <= 5) score += 6;
  if (words.length > 6) score -= 8; // a blurb sentence
  if (/[.!?]$/.test(line) && words.length > 6) score -= 6;
  return Math.max(0, score);
}

/** Review quotes ("A masterpiece" — Someone) are the loudest text on a cover and never the title. */
const QUOTED = /["“”„«»]/;

/** Cleaned, non-noise lines ranked by likelihood of being the title / author. */
export function rankLines(text: string): OcrLine[] {
  const seen = new Set<string>();
  const lines: OcrLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (QUOTED.test(raw)) continue;
    const cleaned = cleanLine(raw);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    const score = scoreLine(cleaned);
    if (score <= 0) continue;
    seen.add(key);
    lines.push({ text: cleaned, score });
  }
  return lines.sort((a, b) => b.score - a.score);
}

/**
 * Up to three queries, strongest first:
 *   1. the two best lines together (usually title + author),
 *   2. the best line alone,
 *   3. the second best line alone.
 */
export function extractSearchQueries(text: string, max = 3): string[] {
  const ranked = rankLines(text);
  const queries: string[] = [];
  const push = (value: string) => {
    const query = value.slice(0, MAX_QUERY_LENGTH).trim();
    if (query.length >= 2 && !queries.some((q) => q.toLowerCase() === query.toLowerCase())) {
      queries.push(query);
    }
  };
  const [first, second] = ranked;
  if (first && second) push(`${first.text} ${second.text}`);
  if (first) push(first.text);
  if (second) push(second.text);
  return queries.slice(0, max);
}

export interface OcrGuess {
  /** A valid ISBN printed on the cover/back, if any — the most reliable route. */
  isbn13: string | null;
  queries: string[];
  /** Best guess for the title when the user ends up adding the book by hand. */
  titleGuess: string;
}

export function interpretOcr(text: string): OcrGuess {
  const ranked = rankLines(text);
  return {
    isbn13: findIsbnInText(text)?.isbn13 ?? null,
    queries: extractSearchQueries(text),
    titleGuess: ranked[0]?.text ?? '',
  };
}
