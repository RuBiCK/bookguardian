/**
 * Book metadata lookup (`/api/lookup/*`). Results are plain queries: the
 * server caches per ISBN, and TanStack Query caches per key on the client so
 * re-opening the same result never refetches.
 */
import { bookDraftSchema, lookupSearchResponseSchema, type BookDraft } from '@bookguardian/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from './client';

export const lookupKeys = {
  isbn: (isbn13: string) => ['lookup', 'isbn', isbn13] as const,
  search: (q: string, limit: number) => ['lookup', 'search', q, limit] as const,
};

/** `null` means "no catalogue knows this ISBN" (a 404), which is not an error for the UI. */
export async function lookupIsbn(isbn13: string): Promise<BookDraft | null> {
  try {
    return await apiRequest(`/api/lookup/isbn/${encodeURIComponent(isbn13)}`, bookDraftSchema);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return null;
    throw error;
  }
}

export async function searchBooks(q: string, limit = 5): Promise<BookDraft[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return (await apiRequest(`/api/lookup/search?${params.toString()}`, lookupSearchResponseSchema))
    .items;
}

export const isbnLookupQueryOptions = (isbn13: string) =>
  queryOptions({
    queryKey: lookupKeys.isbn(isbn13),
    queryFn: () => lookupIsbn(isbn13),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

export const useIsbnLookup = (isbn13: string | null) =>
  useQuery({ ...isbnLookupQueryOptions(isbn13 ?? ''), enabled: isbn13 !== null });

/**
 * Try each OCR-derived query in turn and return the first non-empty result
 * set, so a noisy "title + author" guess can fall back to the title alone.
 */
export async function searchFirstMatch(
  queries: readonly string[],
  limit = 5,
): Promise<{ query: string; items: BookDraft[] }> {
  for (const query of queries) {
    const items = await searchBooks(query, limit);
    if (items.length > 0) return { query, items };
  }
  // Nothing matched: report the best guess so the user sees what was searched.
  return { query: queries[0] ?? '', items: [] };
}
