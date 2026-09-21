/**
 * Merging and ranking of search hits from several providers. Pure functions
 * over `BookDraft`s so the rules are unit-testable without a network:
 *
 * - the same ISBN-13 from two providers is one result (first provider wins,
 *   its blanks filled from the other);
 * - an exact ISBN match outranks everything, then hits matching both the
 *   typed title and author, then title or author alone, then the rest;
 * - ties keep provider order, so Open Library stays ahead of Google Books.
 */
import type { BookDraft, LookupSearchResult } from '@bookguardian/shared';
import type { SearchQuery } from './types';

/** Lower-case, accent-free, single-spaced — what every text comparison works on. */
export function fold(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Every word of `needle` occurs in `haystack` (already folded). */
function contains(haystack: string, needle: string): boolean {
  const words = needle.split(' ').filter(Boolean);
  return words.length > 0 && words.every((word) => haystack.includes(word));
}

/** Relevance of one hit for the query; higher sorts first. */
export function score(draft: BookDraft, query: SearchQuery): number {
  let points = 0;
  if (query.isbn13 && draft.isbn13 === query.isbn13) points += 100;
  if (query.title && contains(fold(`${draft.title} ${draft.subtitle ?? ''}`), fold(query.title)))
    points += 10;
  if (query.author && contains(fold(draft.authors.join(' ')), fold(query.author))) points += 10;
  if (query.publisher && contains(fold(draft.publisher), fold(query.publisher))) points += 2;
  if (query.year && (draft.publishedDate ?? '').includes(String(query.year))) points += 1;
  return points;
}

/** Fill the blanks of `base` from `other` (same book, another provider); `base` keeps its source. */
function complete(base: BookDraft, other: BookDraft): BookDraft {
  return {
    ...base,
    isbn10: base.isbn10 ?? other.isbn10,
    subtitle: base.subtitle ?? other.subtitle,
    authors: base.authors.length > 0 ? base.authors : other.authors,
    publisher: base.publisher ?? other.publisher,
    publishedDate: base.publishedDate ?? other.publishedDate,
    pages: base.pages ?? other.pages,
    language: base.language ?? other.language,
    coverUrl: base.coverUrl ?? other.coverUrl,
    categories: base.categories.length > 0 ? base.categories : other.categories,
    description: base.description ?? other.description,
  };
}

/** Stable identifier for a hit: provider + its own key, else the ISBN, else the folded title/authors. */
export function resultIdOf(draft: BookDraft): string {
  const key =
    draft.sourceId ??
    draft.isbn13 ??
    fold(`${draft.title} ${draft.authors.join(' ')}`).slice(0, 200);
  return `${draft.source}:${key}`;
}

/**
 * Combine each provider's hits (in provider order) into one ranked list of
 * at most `limit` results.
 */
export function mergeResults(
  perProvider: BookDraft[][],
  query: SearchQuery,
  limit: number,
): LookupSearchResult[] {
  const merged: BookDraft[] = [];
  const slotByIsbn = new Map<string, number>();
  for (const drafts of perProvider) {
    for (const draft of drafts) {
      const slot = draft.isbn13 ? slotByIsbn.get(draft.isbn13) : undefined;
      if (slot !== undefined) {
        merged[slot] = complete(merged[slot]!, draft);
        continue;
      }
      if (draft.isbn13) slotByIsbn.set(draft.isbn13, merged.length);
      merged.push(draft);
    }
  }
  return merged
    .map((draft, index) => ({ draft, index, points: score(draft, query) }))
    .sort((a, b) => b.points - a.points || a.index - b.index)
    .slice(0, limit)
    .map(({ draft }) => ({ ...draft, resultId: resultIdOf(draft) }));
}
