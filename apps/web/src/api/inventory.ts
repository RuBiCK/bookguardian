/**
 * Server state for libraries, shelves and books.
 *
 * Every mutation applies its change to the cache first (optimistic UI), rolls
 * back on failure and re-syncs from the server on settle, so lists and counts
 * never wait for the network on a phone.
 */
import {
  applyReadingRules,
  bookPageSchema,
  bookSchema,
  inventoryDefaultsSchema,
  libraryListResponseSchema,
  libraryWithCountsSchema,
  normaliseRating,
  shelfListResponseSchema,
  shelfWithCountSchema,
  todayIso,
  type Book,
  type BookListQuery,
  type BookPage,
  type CreateBookRequest,
  type CreateLibraryInput,
  type CreateShelfInput,
  type InventoryDefaults,
  type LibraryWithCounts,
  type ReadingPatch,
  type ReadStatus,
  type ShelfWithCount,
  type UpdateBookInput,
  type UpdateLibraryInput,
  type UpdateShelfInput,
} from '@bookguardian/shared';
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from './client';

export const PAGE_SIZE = 60;

/** The filters a book list can be narrowed by (everything but paging). */
export type BookFilter = Partial<
  Pick<BookListQuery, 'q' | 'libraryId' | 'shelfId' | 'readStatus' | 'minRating' | 'sort'>
>;

export const keys = {
  libraries: ['libraries'] as const,
  shelves: (libraryId?: string) => ['shelves', libraryId ?? 'all'] as const,
  allShelves: ['shelves'] as const,
  books: (filter: BookFilter) => ['books', filter] as const,
  allBooks: ['books'] as const,
  book: (id: string) => ['book', id] as const,
  defaults: ['defaults'] as const,
};

const deleteResultSchema = z.object({ movedBooks: z.number() });
const emptySchema = z.undefined().or(z.null()).or(z.object({}));

// ---- Queries -------------------------------------------------------------

export const librariesQueryOptions = queryOptions({
  queryKey: keys.libraries,
  queryFn: async () => (await apiRequest('/api/libraries', libraryListResponseSchema)).items,
});

export const shelvesQueryOptions = (libraryId?: string) =>
  queryOptions({
    queryKey: keys.shelves(libraryId),
    queryFn: async () => {
      const search = libraryId ? `?libraryId=${encodeURIComponent(libraryId)}` : '';
      return (await apiRequest(`/api/shelves${search}`, shelfListResponseSchema)).items;
    },
  });

function bookListPath(filter: BookFilter, offset: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  params.set('limit', String(PAGE_SIZE));
  params.set('offset', String(offset));
  return `/api/books?${params.toString()}`;
}

export const booksQueryOptions = (filter: BookFilter) =>
  infiniteQueryOptions({
    queryKey: keys.books(filter),
    queryFn: ({ pageParam }) => apiRequest(bookListPath(filter, pageParam), bookPageSchema),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = last.offset + last.items.length;
      return next < last.total && last.items.length > 0 ? next : undefined;
    },
  });

export const bookQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keys.book(id),
    queryFn: () => apiRequest(`/api/books/${id}`, bookSchema),
  });

export const defaultsQueryOptions = queryOptions({
  queryKey: keys.defaults,
  queryFn: () => apiRequest('/api/defaults', inventoryDefaultsSchema),
});

export const useLibraries = () => useQuery(librariesQueryOptions);
export const useShelves = (libraryId?: string) => useQuery(shelvesQueryOptions(libraryId));
export const useBooks = (filter: BookFilter) => useInfiniteQuery(booksQueryOptions(filter));
export const useBook = (id: string) => useQuery(bookQueryOptions(id));
export const useDefaults = () => useQuery(defaultsQueryOptions);

// ---- Cache helpers -------------------------------------------------------

type BookPages = InfiniteData<BookPage, number>;

function bookMatchesFilter(book: Book, filter: BookFilter, shelfLibrary: Map<string, string>) {
  if (filter.shelfId && filter.shelfId !== book.shelfId) return false;
  if (filter.libraryId && shelfLibrary.get(book.shelfId) !== filter.libraryId) return false;
  if (filter.readStatus && filter.readStatus !== book.readStatus) return false;
  if (filter.minRating && (book.rating ?? 0) < filter.minRating) return false;
  if (filter.q) {
    const q = filter.q.toLowerCase();
    const hay = [book.title, book.subtitle ?? '', ...book.authors].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** Map every cached shelf to its library so library-filtered lists can be patched. */
function shelfLibraryIndex(client: QueryClient): Map<string, string> {
  const index = new Map<string, string>();
  for (const [, data] of client.getQueriesData<ShelfWithCount[]>({ queryKey: keys.allShelves })) {
    for (const shelf of data ?? []) index.set(shelf.id, shelf.libraryId);
  }
  return index;
}

/** Apply `fn` to every cached book list and return the previous data for rollback. */
function patchBookLists(
  client: QueryClient,
  fn: (page: BookPage, filter: BookFilter, index: Map<string, string>) => BookPage,
) {
  const index = shelfLibraryIndex(client);
  const previous = client.getQueriesData<BookPages>({ queryKey: keys.allBooks });
  for (const [queryKey, data] of previous) {
    if (!data) continue;
    const filter = queryKey[1] as BookFilter;
    client.setQueryData<BookPages>(queryKey, {
      ...data,
      pages: data.pages.map((page) => fn(page, filter, index)),
    });
  }
  return previous;
}

function adjustCounts(client: QueryClient, shelfId: string, delta: number) {
  const index = shelfLibraryIndex(client);
  const libraryId = index.get(shelfId);
  client.setQueriesData<ShelfWithCount[]>({ queryKey: keys.allShelves }, (shelves) =>
    shelves?.map((s) =>
      s.id === shelfId ? { ...s, bookCount: Math.max(0, s.bookCount + delta) } : s,
    ),
  );
  if (libraryId) {
    client.setQueryData<LibraryWithCounts[]>(keys.libraries, (libraries) =>
      libraries?.map((l) =>
        l.id === libraryId ? { ...l, bookCount: Math.max(0, l.bookCount + delta) } : l,
      ),
    );
  }
}

interface Snapshot {
  restore(): void;
}

/** Snapshot every query touched by inventory mutations so a failure can rewind them. */
function snapshot(client: QueryClient): Snapshot {
  const entries = [
    ...client.getQueriesData({ queryKey: keys.allBooks }),
    ...client.getQueriesData({ queryKey: keys.allShelves }),
    ...client.getQueriesData({ queryKey: keys.libraries }),
    ...client.getQueriesData({ queryKey: ['book'] }),
  ];
  return {
    restore() {
      for (const [key, data] of entries) client.setQueryData(key, data);
    },
  };
}

async function settle(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: keys.allBooks }),
    client.invalidateQueries({ queryKey: keys.allShelves }),
    client.invalidateQueries({ queryKey: keys.libraries }),
    client.invalidateQueries({ queryKey: keys.defaults }),
  ]);
}

const nowIso = () => new Date().toISOString();

/** Build the book the server will most likely return, so it can be shown right away. */
export function optimisticBook(input: CreateBookRequest & { shelfId: string }): Book {
  const now = nowIso();
  return {
    id: crypto.randomUUID(),
    ownerId: '00000000-0000-4000-8000-000000000000',
    shelfId: input.shelfId,
    isbn10: input.isbn10 ?? null,
    isbn13: input.isbn13 ?? null,
    title: input.title,
    subtitle: input.subtitle ?? null,
    authors: input.authors ?? [],
    publisher: input.publisher ?? null,
    publishedDate: input.publishedDate ?? null,
    pages: input.pages ?? null,
    language: input.language ?? null,
    coverUrl: input.coverUrl ?? null,
    categories: input.categories ?? [],
    description: input.description ?? null,
    notes: input.notes ?? null,
    rating: normaliseRating(input.rating) ?? null,
    readStatus: input.readStatus ?? 'to_read',
    readAt: input.readAt ?? null,
    addedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

// ---- Book mutations ------------------------------------------------------

interface MutationCallbacks<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useCreateBook(callbacks: MutationCallbacks<Book> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookRequest & { shelfId: string }) =>
      apiRequest('/api/books', bookSchema, { method: 'POST', body: input }),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: keys.allBooks });
      const snap = snapshot(client);
      const draft = optimisticBook(input);
      patchBookLists(client, (page, filter, index) =>
        page.offset === 0 && bookMatchesFilter(draft, filter, index)
          ? { ...page, items: [draft, ...page.items], total: page.total + 1 }
          : page,
      );
      adjustCounts(client, input.shelfId, +1);
      return { snap, draftId: draft.id };
    },
    onSuccess: (book, _input, context) => {
      // Swap the placeholder for the real row so links work before the refetch lands.
      patchBookLists(client, (page) => ({
        ...page,
        items: page.items.map((b) => (b.id === context.draftId ? book : b)),
      }));
      client.setQueryData(keys.book(book.id), book);
      callbacks.onSuccess?.(book);
    },
    onError: (error, _input, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: () => settle(client),
  });
}

export function useUpdateBook(callbacks: MutationCallbacks<Book> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBookInput }) =>
      apiRequest(`/api/books/${id}`, bookSchema, { method: 'PATCH', body: input }),
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: keys.allBooks });
      await client.cancelQueries({ queryKey: keys.book(id) });
      const snap = snapshot(client);
      const patch = (book: Book) =>
        book.id === id ? { ...book, ...input, updatedAt: nowIso() } : book;
      const before = client.getQueryData<Book>(keys.book(id));
      client.setQueryData<Book>(keys.book(id), (book) => (book ? patch(book) : book));
      patchBookLists(client, (page) => ({ ...page, items: page.items.map(patch) }));
      if (before && input.shelfId && input.shelfId !== before.shelfId) {
        adjustCounts(client, before.shelfId, -1);
        adjustCounts(client, input.shelfId, +1);
      }
      return { snap };
    },
    onSuccess: (book) => {
      client.setQueryData(keys.book(book.id), book);
      callbacks.onSuccess?.(book);
    },
    onError: (error, _vars, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: (_data, _error, { id }) =>
      Promise.all([settle(client), client.invalidateQueries({ queryKey: keys.book(id) })]),
  });
}

export function useMoveBook(callbacks: MutationCallbacks<Book> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, shelfId }: { id: string; shelfId: string }) =>
      apiRequest(`/api/books/${id}/move`, bookSchema, { method: 'POST', body: { shelfId } }),
    onMutate: async ({ id, shelfId }) => {
      await client.cancelQueries({ queryKey: keys.allBooks });
      const snap = snapshot(client);
      const before = client.getQueryData<Book>(keys.book(id));
      const patch = (book: Book) => (book.id === id ? { ...book, shelfId } : book);
      client.setQueryData<Book>(keys.book(id), (book) => (book ? patch(book) : book));
      patchBookLists(client, (page) => ({ ...page, items: page.items.map(patch) }));
      if (before && before.shelfId !== shelfId) {
        adjustCounts(client, before.shelfId, -1);
        adjustCounts(client, shelfId, +1);
      }
      return { snap };
    },
    onSuccess: (book) => {
      client.setQueryData(keys.book(book.id), book);
      callbacks.onSuccess?.(book);
    },
    onError: (error, _vars, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: (_data, _error, { id }) =>
      Promise.all([settle(client), client.invalidateQueries({ queryKey: keys.book(id) })]),
  });
}

export function useDeleteBook(callbacks: MutationCallbacks<void> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (book: Book) => {
      await apiRequest(`/api/books/${book.id}`, emptySchema, { method: 'DELETE' });
    },
    onMutate: async (book) => {
      await client.cancelQueries({ queryKey: keys.allBooks });
      const snap = snapshot(client);
      patchBookLists(client, (page) => {
        const items = page.items.filter((b) => b.id !== book.id);
        return items.length === page.items.length
          ? page
          : { ...page, items, total: page.total - 1 };
      });
      adjustCounts(client, book.shelfId, -1);
      client.removeQueries({ queryKey: keys.book(book.id) });
      return { snap };
    },
    onSuccess: () => callbacks.onSuccess?.(),
    onError: (error, _book, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: () => settle(client),
  });
}

export type ReadingActions = ReturnType<typeof useUpdateBook> & {
  /** 0 clears the rating. */
  setRating(book: Book, rating: number): void;
  /** Change the status; the finished date follows the shared reading rules (today stamped on read). */
  setStatus(book: Book, readStatus: ReadStatus): void;
  /** Edit the finished date of a read book (null clears). */
  setReadAt(book: Book, readAt: string | null): void;
};

/**
 * Rating / status / dates actions used by the book page and the long-press
 * quick actions. The patch sent is exactly what the server will store, so
 * the optimistic cache never disagrees with the reply.
 */
export function useSetReading(callbacks: MutationCallbacks<Book> = {}): ReadingActions {
  const update = useUpdateBook(callbacks);
  const apply = (book: Book, patch: ReadingPatch) => {
    const result = applyReadingRules(book, patch, todayIso());
    // A contradictory date cannot come from the controls; report it rather than send it.
    if (!result.ok) {
      callbacks.onError?.(new Error(result.error));
      return;
    }
    update.mutate({ id: book.id, input: result.value });
  };
  return {
    ...update,
    setRating: (book, rating) =>
      update.mutate({ id: book.id, input: { rating: normaliseRating(rating) ?? null } }),
    setStatus: (book, readStatus) => apply(book, { readStatus }),
    setReadAt: (book, readAt) => apply(book, { readAt }),
  };
}

// ---- Library mutations ---------------------------------------------------

export function useCreateLibrary(callbacks: MutationCallbacks<LibraryWithCounts> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLibraryInput) =>
      apiRequest('/api/libraries', libraryWithCountsSchema, { method: 'POST', body: input }),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: keys.libraries });
      const snap = snapshot(client);
      const now = nowIso();
      const draft: LibraryWithCounts = {
        id: crypto.randomUUID(),
        ownerId: '00000000-0000-4000-8000-000000000000',
        name: input.name,
        location: input.location ?? null,
        shelfCount: 0,
        bookCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      client.setQueryData<LibraryWithCounts[]>(keys.libraries, (list) => [...(list ?? []), draft]);
      return { snap };
    },
    onSuccess: (library) => callbacks.onSuccess?.(library),
    onError: (error, _input, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: () => settle(client),
  });
}

export function useUpdateLibrary(callbacks: MutationCallbacks<LibraryWithCounts> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLibraryInput }) =>
      apiRequest(`/api/libraries/${id}`, libraryWithCountsSchema, { method: 'PATCH', body: input }),
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: keys.libraries });
      const snap = snapshot(client);
      client.setQueryData<LibraryWithCounts[]>(keys.libraries, (list) =>
        list?.map((l) => (l.id === id ? { ...l, ...input, updatedAt: nowIso() } : l)),
      );
      return { snap };
    },
    onSuccess: (library) => callbacks.onSuccess?.(library),
    onError: (error, _vars, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: () => settle(client),
  });
}

export function useDeleteLibrary(callbacks: MutationCallbacks<void> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, moveBooksTo }: { id: string; moveBooksTo?: string }) => {
      const query = moveBooksTo ? `?moveBooksTo=${encodeURIComponent(moveBooksTo)}` : '';
      await apiRequest(`/api/libraries/${id}${query}`, deleteResultSchema, { method: 'DELETE' });
    },
    onMutate: async ({ id }) => {
      await client.cancelQueries({ queryKey: keys.libraries });
      const snap = snapshot(client);
      client.setQueryData<LibraryWithCounts[]>(keys.libraries, (list) =>
        list?.filter((l) => l.id !== id),
      );
      return { snap };
    },
    onSuccess: () => callbacks.onSuccess?.(),
    onError: (error, _vars, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: () => settle(client),
  });
}

// ---- Shelf mutations -----------------------------------------------------

export function useCreateShelf(callbacks: MutationCallbacks<ShelfWithCount> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShelfInput) =>
      apiRequest('/api/shelves', shelfWithCountSchema, { method: 'POST', body: input }),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: keys.allShelves });
      const snap = snapshot(client);
      const now = nowIso();
      const siblings = client.getQueryData<ShelfWithCount[]>(keys.shelves(input.libraryId)) ?? [];
      const draft: ShelfWithCount = {
        id: crypto.randomUUID(),
        ownerId: '00000000-0000-4000-8000-000000000000',
        libraryId: input.libraryId,
        name: input.name,
        sortOrder: input.sortOrder ?? siblings.length,
        bookCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      client.setQueryData<ShelfWithCount[]>(keys.shelves(input.libraryId), (list) => [
        ...(list ?? []),
        draft,
      ]);
      client.setQueryData<LibraryWithCounts[]>(keys.libraries, (list) =>
        list?.map((l) => (l.id === input.libraryId ? { ...l, shelfCount: l.shelfCount + 1 } : l)),
      );
      return { snap };
    },
    onSuccess: (shelf) => callbacks.onSuccess?.(shelf),
    onError: (error, _input, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: () => settle(client),
  });
}

export function useUpdateShelf(callbacks: MutationCallbacks<ShelfWithCount> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateShelfInput }) =>
      apiRequest(`/api/shelves/${id}`, shelfWithCountSchema, { method: 'PATCH', body: input }),
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: keys.allShelves });
      const snap = snapshot(client);
      client.setQueriesData<ShelfWithCount[]>({ queryKey: keys.allShelves }, (list) =>
        list?.map((s) => (s.id === id ? { ...s, ...input, updatedAt: nowIso() } : s)),
      );
      return { snap };
    },
    onSuccess: (shelf) => callbacks.onSuccess?.(shelf),
    onError: (error, _vars, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: () => settle(client),
  });
}

export function useReorderShelves(callbacks: MutationCallbacks<ShelfWithCount[]> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ libraryId, shelfIds }: { libraryId: string; shelfIds: string[] }) =>
      (
        await apiRequest('/api/shelves/reorder', shelfListResponseSchema, {
          method: 'POST',
          body: { libraryId, shelfIds },
        })
      ).items,
    onMutate: async ({ libraryId, shelfIds }) => {
      await client.cancelQueries({ queryKey: keys.allShelves });
      const snap = snapshot(client);
      client.setQueryData<ShelfWithCount[]>(keys.shelves(libraryId), (list) => {
        if (!list) return list;
        const byId = new Map(list.map((s) => [s.id, s]));
        return shelfIds.flatMap((id, sortOrder) => {
          const shelf = byId.get(id);
          return shelf ? [{ ...shelf, sortOrder }] : [];
        });
      });
      return { snap };
    },
    onSuccess: (shelves) => callbacks.onSuccess?.(shelves),
    onError: (error, _vars, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: () => settle(client),
  });
}

export function useDeleteShelf(callbacks: MutationCallbacks<void> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, moveBooksTo }: { id: string; moveBooksTo?: string }) => {
      const query = moveBooksTo ? `?moveBooksTo=${encodeURIComponent(moveBooksTo)}` : '';
      await apiRequest(`/api/shelves/${id}${query}`, deleteResultSchema, { method: 'DELETE' });
    },
    onMutate: async ({ id }) => {
      await client.cancelQueries({ queryKey: keys.allShelves });
      const snap = snapshot(client);
      let libraryId: string | undefined;
      client.setQueriesData<ShelfWithCount[]>({ queryKey: keys.allShelves }, (list) => {
        libraryId ??= list?.find((s) => s.id === id)?.libraryId;
        return list?.filter((s) => s.id !== id);
      });
      if (libraryId) {
        client.setQueryData<LibraryWithCounts[]>(keys.libraries, (list) =>
          list?.map((l) =>
            l.id === libraryId ? { ...l, shelfCount: Math.max(0, l.shelfCount - 1) } : l,
          ),
        );
      }
      return { snap };
    },
    onSuccess: () => callbacks.onSuccess?.(),
    onError: (error, _vars, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: () => settle(client),
  });
}

export type { InventoryDefaults };
