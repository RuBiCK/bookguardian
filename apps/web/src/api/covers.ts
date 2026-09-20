/**
 * Covers: where a book's image is served from, uploads of a user's own
 * photo, and the "find missing covers" backfill.
 *
 * A cover arrives after the book does (the API resolves it in the
 * background), so the book queries poll every couple of seconds while any
 * listed book says `coverPending`, and stop as soon as it settles.
 */
import {
  bookSchema,
  coverBackfillResponseSchema,
  coverBackfillStatusSchema,
  coverPath,
  IDLE_BACKFILL,
  type Book,
  type BookPage,
  type CoverBackfillStatus,
  type CoverVariant,
} from '@bookguardian/shared';
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { API_BASE_URL, apiRequest } from './client';
import { keys } from './inventory';

/** Absolute (or proxy-relative) URL of a stored cover variant. */
export function coverSrc(assetId: string, variant: CoverVariant = 'full'): string {
  return `${API_BASE_URL}${coverPath(assetId, variant)}`;
}

/** How often to ask again while a cover is still being looked up. */
export const COVER_POLL_MS = 2000;

export const hasPendingCover = (books: Book[] | undefined) =>
  books?.some((b) => b.coverPending) ?? false;

export const pagesHavePendingCover = (data: InfiniteData<BookPage, number> | undefined) =>
  data?.pages.some((page) => hasPendingCover(page.items)) ?? false;

// ---- Upload / remove -------------------------------------------------------

export interface UploadCoverInput {
  bookId: string;
  file: File | Blob;
  /** Only fill an empty slot (the scan's cover shot); never replace a catalogue cover. */
  fallback?: boolean;
}

export async function uploadCover({ bookId, file, fallback = false }: UploadCoverInput) {
  const body = new FormData();
  body.set('file', file, file instanceof File ? file.name : 'cover.jpg');
  const query = fallback ? '?fallback=true' : '';
  const response = await fetch(`${API_BASE_URL}/api/books/${bookId}/cover${query}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body,
  });
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(`Cover upload failed (${response.status})`);
  return bookSchema.parse(json);
}

function storeBook(client: QueryClient, book: Book) {
  client.setQueryData(keys.book(book.id), book);
  void client.invalidateQueries({ queryKey: keys.allBooks });
}

interface Callbacks<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useUploadCover(callbacks: Callbacks<Book> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: uploadCover,
    onSuccess: (book) => {
      storeBook(client, book);
      callbacks.onSuccess?.(book);
    },
    onError: (error) => callbacks.onError?.(error),
  });
}

/**
 * After a book was added from a cover photo, offer that photo as its cover
 * in case no catalogue cover turns up. Best effort: a failure is only
 * logged, the book is already saved.
 */
export function useFallbackCover() {
  const upload = useUploadCover({
    onError: (error) => console.warn('[covers] fallback photo not stored', error),
  });
  return (book: Book, photo: File | Blob | null | undefined) => {
    if (photo) upload.mutate({ bookId: book.id, file: photo, fallback: true });
  };
}

export function useRemoveCover(callbacks: Callbacks<Book> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (bookId: string) =>
      apiRequest(`/api/books/${bookId}/cover`, bookSchema, { method: 'DELETE' }),
    onSuccess: (book) => {
      storeBook(client, book);
      callbacks.onSuccess?.(book);
    },
    onError: (error) => callbacks.onError?.(error),
  });
}

// ---- Backfill --------------------------------------------------------------

export const backfillKey = ['covers', 'backfill'] as const;

export const backfillStatusQueryOptions = queryOptions({
  queryKey: backfillKey,
  queryFn: () => apiRequest('/api/covers/backfill', coverBackfillStatusSchema),
  refetchInterval: (query) => (query.state.data?.pending ? 1000 : false),
});

export const useBackfillStatus = (enabled = true) =>
  useQuery({ ...backfillStatusQueryOptions, enabled });

export function useStartBackfill(callbacks: Callbacks<{ queued: number }> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest('/api/covers/backfill', coverBackfillResponseSchema, { method: 'POST' }),
    onSuccess: async (result) => {
      const status: CoverBackfillStatus = {
        ...IDLE_BACKFILL,
        queued: result.queued,
        pending: result.queued,
      };
      client.setQueryData(backfillKey, status);
      await client.invalidateQueries({ queryKey: backfillKey });
      callbacks.onSuccess?.(result);
    },
    onError: (error) => callbacks.onError?.(error),
  });
}
