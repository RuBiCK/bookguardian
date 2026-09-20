/**
 * Server state for lendings: who has which book. Lending and returning are
 * optimistic like every inventory mutation — the row moves the moment the
 * user taps, is rolled back on failure and re-synced once the server replies.
 */
import {
  borrowerListResponseSchema,
  isOverdue,
  lendingListResponseSchema,
  lendingWithBookSchema,
  type Book,
  type CreateLendingInput,
  type LendingWithBook,
} from '@bookguardian/shared';
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { apiRequest } from './client';

export const lendingKeys = {
  all: ['lendings'] as const,
  active: ['lendings', 'active'] as const,
  book: (bookId: string) => ['lendings', 'book', bookId] as const,
  borrowers: ['lendings', 'borrowers'] as const,
};

// ---- Queries -------------------------------------------------------------

export const activeLendingsQueryOptions = queryOptions({
  queryKey: lendingKeys.active,
  queryFn: async () => (await apiRequest('/api/lendings', lendingListResponseSchema)).items,
});

export const bookLendingsQueryOptions = (bookId: string) =>
  queryOptions({
    queryKey: lendingKeys.book(bookId),
    queryFn: async () =>
      (await apiRequest(`/api/books/${bookId}/lendings`, lendingListResponseSchema)).items,
  });

export const borrowersQueryOptions = queryOptions({
  queryKey: lendingKeys.borrowers,
  queryFn: async () =>
    (await apiRequest('/api/lendings/borrowers', borrowerListResponseSchema)).items,
});

export const useActiveLendings = () => useQuery(activeLendingsQueryOptions);
export const useBookLendings = (bookId: string) => useQuery(bookLendingsQueryOptions(bookId));
export const useBorrowers = () => useQuery(borrowersQueryOptions);

/** Ids of the books currently out, for the "Lent" badge on covers. */
export function useLentBookIds(): ReadonlySet<string> {
  const lendings = useActiveLendings();
  return new Set(lendings.data?.map((l) => l.bookId));
}

/** The open lending of one book (from its history), if any. */
export function activeLendingOf(history: LendingWithBook[] | undefined): LendingWithBook | null {
  return history?.find((l) => l.returnedAt === null) ?? null;
}

// ---- Cache helpers -------------------------------------------------------

interface Snapshot {
  restore(): void;
}

function snapshot(client: QueryClient): Snapshot {
  const entries = client.getQueriesData({ queryKey: lendingKeys.all });
  return {
    restore() {
      for (const [key, data] of entries) client.setQueryData(key, data);
    },
  };
}

/** Apply `fn` to every cached lending list (active, per-book) that is loaded. */
function patchLists(
  client: QueryClient,
  fn: (items: LendingWithBook[], key: readonly unknown[]) => LendingWithBook[],
) {
  for (const [key, data] of client.getQueriesData<LendingWithBook[]>({
    queryKey: lendingKeys.all,
  })) {
    if (data) client.setQueryData<LendingWithBook[]>(key, fn(data, key));
  }
}

const isListKey = (key: readonly unknown[]) => key[1] === 'active' || key[1] === 'book';

const nowIso = () => new Date().toISOString();

/** The lending the server will most likely create, so it shows up right away. */
export function optimisticLending(input: CreateLendingInput, book: Book): LendingWithBook {
  const now = nowIso();
  const lending = {
    id: crypto.randomUUID(),
    ownerId: book.ownerId,
    bookId: book.id,
    borrowerName: input.borrowerName.trim(),
    borrowerContact: input.borrowerContact?.trim() ? input.borrowerContact.trim() : null,
    lentAt: input.lentAt ?? now,
    dueAt: input.dueAt ?? null,
    returnedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...lending,
    overdue: isOverdue(lending),
    book: {
      id: book.id,
      title: book.title,
      authors: book.authors,
      coverAssetId: book.coverAssetId,
      coverUrl: book.coverUrl,
      shelfId: book.shelfId,
    },
  };
}

// ---- Mutations -----------------------------------------------------------

interface MutationCallbacks<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useLendBook(callbacks: MutationCallbacks<LendingWithBook> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input }: { input: CreateLendingInput; book: Book }) =>
      apiRequest('/api/lendings', lendingWithBookSchema, { method: 'POST', body: input }),
    onMutate: async ({ input, book }) => {
      await client.cancelQueries({ queryKey: lendingKeys.all });
      const snap = snapshot(client);
      const draft = optimisticLending(input, book);
      patchLists(client, (items, key) => {
        if (key[1] === 'active' || (key[1] === 'book' && key[2] === book.id)) {
          return [draft, ...items];
        }
        return items;
      });
      return { snap, draftId: draft.id };
    },
    onSuccess: (lending, _vars, context) => {
      patchLists(client, (items, key) =>
        isListKey(key) ? items.map((l) => (l.id === context.draftId ? lending : l)) : items,
      );
      callbacks.onSuccess?.(lending);
    },
    onError: (error, _vars, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: () => client.invalidateQueries({ queryKey: lendingKeys.all }),
  });
}

export function useReturnLending(callbacks: MutationCallbacks<LendingWithBook> = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (lending: LendingWithBook) =>
      apiRequest(`/api/lendings/${lending.id}/return`, lendingWithBookSchema, {
        method: 'POST',
        body: {},
      }),
    onMutate: async (lending) => {
      await client.cancelQueries({ queryKey: lendingKeys.all });
      const snap = snapshot(client);
      const returnedAt = nowIso();
      patchLists(client, (items, key) => {
        if (key[1] === 'active') return items.filter((l) => l.id !== lending.id);
        if (key[1] === 'book') {
          return items.map((l) =>
            l.id === lending.id ? { ...l, returnedAt, overdue: false, updatedAt: returnedAt } : l,
          );
        }
        return items;
      });
      return { snap };
    },
    onSuccess: (lending) => {
      patchLists(client, (items, key) =>
        key[1] === 'book' ? items.map((l) => (l.id === lending.id ? lending : l)) : items,
      );
      callbacks.onSuccess?.(lending);
    },
    onError: (error, _vars, context) => {
      context?.snap.restore();
      callbacks.onError?.(error);
    },
    onSettled: () => client.invalidateQueries({ queryKey: lendingKeys.all }),
  });
}
