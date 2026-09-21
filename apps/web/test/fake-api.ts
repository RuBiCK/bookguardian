/**
 * In-memory stand-in for the inventory API, mounted on `globalThis.fetch`.
 * Mirrors the routes, defaults and cascade rules the real Hono app exposes so
 * screens can be exercised end-to-end without a database.
 */
import {
  coverPath,
  isOverdue,
  normaliseRating,
  resolveReadAt,
  STATS_MONTHS,
  STATS_TOP_N,
  type AuthMeResponse,
  type Book,
  type BookDraft,
  type CoverBackfillStatus,
  type Lending,
  type LendingWithBook,
  type LibraryWithCounts,
  type ShelfWithCount,
  type Stats,
} from '@bookguardian/shared';
import { vi } from 'vitest';

const OWNER = '11111111-1111-4111-8111-111111111111';
let counter = 0;
export const uuid = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
};
let lastTs = 0;
/** Strictly increasing timestamps so "newest first" is deterministic within one test. */
const now = () => {
  lastTs = Math.max(lastTs + 1, Date.now());
  return new Date(lastTs).toISOString();
};

type Library = Omit<LibraryWithCounts, 'shelfCount' | 'bookCount'>;
type Shelf = Omit<ShelfWithCount, 'bookCount'>;

export interface FakeApi {
  libraries: Library[];
  shelves: Shelf[];
  books: Book[];
  lendings: Lending[];
  /** Every request seen, oldest first. */
  calls: { method: string; path: string; body?: unknown }[];
  /** Make the next matching request fail with this status. */
  failNext(matcher: { method?: string; path?: RegExp }, status?: number): void;
  /** Catalogue stand-in for `/api/lookup/*`: drafts by ISBN-13 and free-text results. */
  drafts: Record<string, BookDraft>;
  searchResults: BookDraft[];
  /** Answer every lookup with 503 (providers down). */
  lookupDown: boolean;
  /** Cover uploads received: book id + file name + whether it was a fallback. */
  uploads: { bookId: string; name: string; fallback: boolean }[];
  /** What `GET /api/covers/backfill` reports; `POST` resets it from `backfillQueued`. */
  backfill: CoverBackfillStatus;
  backfillQueued: number;
  /** Give a book a stored cover (an asset id), as the API's cascade would. */
  setCover(bookId: string, assetId: string | null, override?: boolean): void;
  /** Who `/api/auth/me` answers with; `null` makes every protected route a 401. */
  user: AuthMeResponse | null;
  addLibrary(name: string, location?: string | null): Library;
  addShelf(libraryId: string, name: string, sortOrder?: number): Shelf;
  addBook(input: Partial<Book> & { title: string; shelfId?: string }): Book;
  addLending(input: Partial<Lending> & { bookId: string; borrowerName: string }): Lending;
  restore(): void;
}

function json(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
const error = (status: number, code: string, details?: unknown) =>
  json({ error: { code, message: code, details } }, status);

export function installFakeApi(): FakeApi {
  const libraries: Library[] = [];
  const shelves: Shelf[] = [];
  const books: Book[] = [];
  const lendings: Lending[] = [];
  const calls: FakeApi['calls'] = [];
  let failure: { matcher: { method?: string; path?: RegExp }; status: number } | null = null;
  const lookup = {
    drafts: {} as Record<string, BookDraft>,
    searchResults: [] as BookDraft[],
    down: false,
  };
  const uploads: FakeApi['uploads'] = [];
  const covers = {
    backfill: { queued: 0, pending: 0, done: 0, found: 0, failed: 0 },
    backfillQueued: 0,
  };
  const auth: { user: AuthMeResponse | null } = {
    user: {
      id: OWNER,
      displayName: 'Ana Lector',
      email: 'ana@example.com',
      avatarUrl: null,
    },
  };
  let assetCounter = 0;
  const newAssetId = () => {
    assetCounter += 1;
    return assetCounter.toString(16).padStart(64, '0');
  };
  const setCover: FakeApi['setCover'] = (bookId, assetId, override = false) => {
    const book = books.find((b) => b.id === bookId);
    if (!book) throw new Error('fake api: no book');
    book.coverAssetId = assetId;
    book.coverOverride = override;
    book.coverUrl = assetId ? coverPath(assetId) : null;
    book.coverPending = false;
  };

  const addLibrary: FakeApi['addLibrary'] = (name, location = null) => {
    const ts = now();
    const library = { id: uuid(), ownerId: OWNER, name, location, createdAt: ts, updatedAt: ts };
    libraries.push(library);
    return library;
  };
  const addShelf: FakeApi['addShelf'] = (libraryId, name, sortOrder) => {
    const ts = now();
    const order = sortOrder ?? shelves.filter((s) => s.libraryId === libraryId).length;
    const shelf = {
      id: uuid(),
      ownerId: OWNER,
      libraryId,
      name,
      sortOrder: order,
      createdAt: ts,
      updatedAt: ts,
    };
    shelves.push(shelf);
    return shelf;
  };
  const addBook: FakeApi['addBook'] = (input) => {
    const ts = now();
    const book: Book = {
      id: uuid(),
      ownerId: OWNER,
      shelfId: input.shelfId ?? defaults().shelfId,
      isbn10: null,
      isbn13: null,
      subtitle: null,
      authors: [],
      publisher: null,
      publishedDate: null,
      pages: null,
      language: null,
      coverAssetId: null,
      coverOverride: false,
      coverUrl: null,
      coverPending: false,
      categories: [],
      description: null,
      notes: null,
      rating: null,
      readStatus: 'to_read',
      readAt: null,
      addedAt: ts,
      createdAt: ts,
      updatedAt: ts,
      ...input,
    };
    books.push(book);
    return book;
  };

  const addLending: FakeApi['addLending'] = (input) => {
    const ts = now();
    const lending: Lending = {
      id: uuid(),
      ownerId: OWNER,
      borrowerContact: null,
      lentAt: ts,
      dueAt: null,
      returnedAt: null,
      createdAt: ts,
      updatedAt: ts,
      ...input,
    };
    lendings.push(lending);
    return lending;
  };
  // Same shape and ordering as apps/api/src/lending.ts.
  const withBook = (l: Lending): LendingWithBook | null => {
    const b = books.find((book) => book.id === l.bookId);
    if (!b) return null;
    return {
      ...l,
      overdue: isOverdue(l),
      book: {
        id: b.id,
        title: b.title,
        authors: b.authors,
        coverAssetId: b.coverAssetId,
        coverUrl: b.coverUrl,
        shelfId: b.shelfId,
      },
    };
  };
  const listLendings = (filter: { active?: boolean; bookId?: string; overdue?: boolean }) =>
    [...lendings]
      .sort((a, b) => b.lentAt.localeCompare(a.lentAt) || b.createdAt.localeCompare(a.createdAt))
      .filter((l) => filter.active === undefined || (l.returnedAt === null) === filter.active)
      .filter((l) => !filter.bookId || l.bookId === filter.bookId)
      .map(withBook)
      .filter((l): l is LendingWithBook => l !== null)
      .filter((l) => !filter.overdue || l.overdue);

  const bookCount = (shelfId: string) => books.filter((b) => b.shelfId === shelfId).length;
  const withCounts = (l: Library): LibraryWithCounts => {
    const own = shelves.filter((s) => s.libraryId === l.id);
    return {
      ...l,
      shelfCount: own.length,
      bookCount: own.reduce((n, s) => n + bookCount(s.id), 0),
    };
  };
  const shelfWithCount = (s: Shelf): ShelfWithCount => ({ ...s, bookCount: bookCount(s.id) });
  const sortedShelves = (list: Shelf[]) =>
    [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  const defaults = () => {
    const recent = [...books].sort((a, b) => b.addedAt.localeCompare(a.addedAt))[0];
    const shelf = recent
      ? shelves.find((s) => s.id === recent.shelfId)
      : sortedShelves(shelves.filter((s) => s.libraryId === libraries[0]?.id))[0];
    if (!shelf) throw new Error('fake api: no shelf');
    return { libraryId: shelf.libraryId, shelfId: shelf.id };
  };

  const computeStats = (): Stats => {
    const groups = (values: (string | null)[]) => {
      const counts = new Map<string, number>();
      for (const v of values) if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1);
      return [...counts]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    };
    const topN = (all: { key: string; count: number }[]) => ({
      top: all.slice(0, STATS_TOP_N),
      other: all.slice(STATS_TOP_N).reduce((n, g) => n + g.count, 0),
    });
    const byStatus = (status: Book['readStatus']) =>
      books.filter((b) => b.readStatus === status).length;
    const read = books.filter((b) => b.readStatus === 'read' && b.readAt);
    const today = new Date();
    const months = Array.from({ length: STATS_MONTHS }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (STATS_MONTHS - 1 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const libraryName = new Map(libraries.map((l) => [l.id, l.name]));
    const byShelf = shelves
      .map((s) => ({
        id: s.id,
        name: s.name,
        libraryId: s.libraryId,
        libraryName: libraryName.get(s.libraryId) ?? '',
        count: bookCount(s.id),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
      totals: {
        books: books.length,
        read: byStatus('read'),
        reading: byStatus('reading'),
        toRead: byStatus('to_read'),
        lent: lendings.filter((l) => l.returnedAt === null).length,
        rated: books.filter((b) => b.rating !== null).length,
        pages: books.reduce((n, b) => n + (b.pages ?? 0), 0),
      },
      byLibrary: libraries
        .map((l) => ({ id: l.id, name: l.name, count: withCounts(l).bookCount }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      byShelf,
      byReadStatus: {
        to_read: byStatus('to_read'),
        reading: byStatus('reading'),
        read: byStatus('read'),
      },
      byCategory: topN(groups(books.flatMap((b) => b.categories))),
      byLanguage: topN(groups(books.map((b) => b.language))),
      byRating: [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count: books.filter((b) => b.rating === rating).length,
      })),
      readByMonth: months.map((month) => ({
        month,
        count: read.filter((b) => b.readAt!.startsWith(month)).length,
      })),
      readByYear: groups(read.map((b) => b.readAt!.slice(0, 4)))
        .map((g) => ({ year: g.key, count: g.count }))
        .sort((a, b) => a.year.localeCompare(b.year)),
      topAuthors: topN(groups(books.flatMap((b) => b.authors))),
      topPublishers: topN(groups(books.map((b) => b.publisher))),
    };
  };

  const handle = (method: string, url: URL, body: unknown): Response => {
    const path = url.pathname;
    const q = url.searchParams;
    const match = (re: RegExp) => re.exec(path);
    let m: RegExpExecArray | null;

    // Auth: the session, and everything else needs one (like `authMiddleware`).
    if (path === '/api/auth/me') {
      if (!auth.user) return error(401, 'unauthenticated');
      if (method === 'DELETE') {
        const { confirmEmail } = body as { confirmEmail?: string };
        if ((confirmEmail ?? '').trim().toLowerCase() !== auth.user.email) {
          return error(422, 'confirm_email_mismatch');
        }
        auth.user = null;
        libraries.length = 0;
        shelves.length = 0;
        books.length = 0;
        lendings.length = 0;
        return new Response(null, { status: 204 });
      }
      return json(auth.user);
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      auth.user = null;
      return new Response(null, { status: 204 });
    }
    if (path === '/api/health') {
      return json({
        status: 'ok',
        version: 't',
        uptimeSeconds: 0,
        database: { driver: 'sqlite', reachable: true },
      });
    }
    if (!auth.user) return error(401, 'unauthenticated');

    // Covers
    if (path === '/api/covers/backfill' && method === 'POST') {
      covers.backfill = {
        queued: covers.backfillQueued,
        pending: covers.backfillQueued,
        done: 0,
        found: 0,
        failed: 0,
      };
      return json({ queued: covers.backfillQueued }, 202);
    }
    if (path === '/api/covers/backfill' && method === 'GET') return json(covers.backfill);
    if ((m = match(/^\/api\/books\/([^/]+)\/cover$/))) {
      const book = books.find((b) => b.id === m![1]);
      if (!book) return error(404, 'not_found');
      if (method === 'DELETE') {
        setCover(book.id, null, false);
        return json(book);
      }
      if (method === 'POST') {
        const form = body as FormData;
        const file = form.get('file');
        if (!(file instanceof Blob)) return error(422, 'validation_error');
        const fallback = q.get('fallback') === 'true';
        uploads.push({ bookId: book.id, name: file instanceof File ? file.name : '', fallback });
        if (fallback && (book.coverAssetId || book.coverOverride)) return json(book, 202);
        setCover(book.id, newAssetId(), !fallback);
        return json(book);
      }
    }

    if (path === '/api/defaults') return json(defaults());

    // Lookup
    if (path.startsWith('/api/lookup/')) {
      if (lookup.down) return error(503, 'lookup_unavailable');
      if ((m = match(/^\/api\/lookup\/isbn\/([^/]+)$/))) {
        const draft = lookup.drafts[m[1]!];
        return draft ? json(draft) : error(404, 'isbn_not_found', { isbn: m[1] });
      }
      if (path === '/api/lookup/search') {
        const limit = Number(q.get('limit') ?? 5);
        // Word-wise, like a real provider: "F. Herbert" still finds Frank Herbert.
        const has = (haystack: string, field: string) => {
          const words = (q.get(field) ?? '')
            .toLowerCase()
            .split(/[^\p{L}\p{N}]+/u)
            .filter(Boolean);
          return words.every((word) => haystack.toLowerCase().includes(word));
        };
        if (!['q', 'title', 'author', 'isbn', 'publisher', 'year'].some((f) => q.get(f)?.trim()))
          return error(422, 'validation_error');
        // Like the real thing: structured fields narrow, exact ISBN first, stable ids.
        const isbn = q.get('isbn')?.replace(/[^0-9X]/gi, '');
        const items = lookup.searchResults
          .filter(
            (d) =>
              has([d.title, ...d.authors].join(' '), 'q') &&
              has(`${d.title} ${d.subtitle ?? ''}`, 'title') &&
              has(d.authors.join(' '), 'author') &&
              has(d.publisher ?? '', 'publisher') &&
              (!q.get('year') || (d.publishedDate ?? '').includes(q.get('year')!)),
          )
          .sort((a, b) => Number(b.isbn13 === isbn) - Number(a.isbn13 === isbn))
          .slice(0, limit)
          .map((d) => ({ ...d, resultId: `${d.source}:${d.sourceId ?? d.isbn13 ?? d.title}` }));
        return json({ items });
      }
    }

    // Libraries
    if (path === '/api/libraries' && method === 'GET')
      return json({ items: libraries.map(withCounts) });
    if (path === '/api/libraries' && method === 'POST') {
      const input = body as { name: string; location?: string | null };
      return json(withCounts(addLibrary(input.name, input.location ?? null)), 201);
    }
    if ((m = match(/^\/api\/libraries\/([^/]+)$/))) {
      const library = libraries.find((l) => l.id === m![1]);
      if (!library) return error(404, 'not_found');
      if (method === 'GET') return json(withCounts(library));
      if (method === 'PATCH') {
        Object.assign(library, body, { updatedAt: now() });
        return json(withCounts(library));
      }
      if (method === 'DELETE') {
        if (libraries.length <= 1) return error(409, 'last_library');
        const own = shelves.filter((s) => s.libraryId === library.id).map((s) => s.id);
        const held = books.filter((b) => own.includes(b.shelfId));
        const target = q.get('moveBooksTo');
        if (held.length > 0) {
          if (!target) return error(409, 'library_not_empty', { bookCount: held.length });
          if (own.includes(target) || !shelves.some((s) => s.id === target))
            return error(422, 'unknown_shelf');
          held.forEach((b) => (b.shelfId = target));
        }
        for (const id of own)
          shelves.splice(
            shelves.findIndex((s) => s.id === id),
            1,
          );
        libraries.splice(libraries.indexOf(library), 1);
        return json({ movedBooks: held.length });
      }
    }

    // Shelves
    if (path === '/api/shelves' && method === 'GET') {
      const libraryId = q.get('libraryId');
      if (libraryId && !libraries.some((l) => l.id === libraryId)) return error(404, 'not_found');
      const list = libraryId ? shelves.filter((s) => s.libraryId === libraryId) : shelves;
      return json({ items: sortedShelves(list).map(shelfWithCount) });
    }
    if (path === '/api/shelves' && method === 'POST') {
      const input = body as { libraryId: string; name: string; sortOrder?: number };
      if (!libraries.some((l) => l.id === input.libraryId)) return error(422, 'unknown_library');
      return json(shelfWithCount(addShelf(input.libraryId, input.name, input.sortOrder)), 201);
    }
    if (path === '/api/shelves/reorder' && method === 'POST') {
      const { libraryId, shelfIds } = body as { libraryId: string; shelfIds: string[] };
      const own = shelves.filter((s) => s.libraryId === libraryId);
      if (own.length !== shelfIds.length || !shelfIds.every((id) => own.some((s) => s.id === id))) {
        return error(422, 'shelf_mismatch');
      }
      shelfIds.forEach((id, i) => (own.find((s) => s.id === id)!.sortOrder = i));
      return json({ items: sortedShelves(own).map(shelfWithCount) });
    }
    if ((m = match(/^\/api\/shelves\/([^/]+)$/))) {
      const shelf = shelves.find((s) => s.id === m![1]);
      if (!shelf) return error(404, 'not_found');
      if (method === 'GET') return json(shelfWithCount(shelf));
      if (method === 'PATCH') {
        Object.assign(shelf, body, { updatedAt: now() });
        return json(shelfWithCount(shelf));
      }
      if (method === 'DELETE') {
        if (shelves.filter((s) => s.libraryId === shelf.libraryId).length <= 1)
          return error(409, 'last_shelf');
        const held = books.filter((b) => b.shelfId === shelf.id);
        const target = q.get('moveBooksTo');
        if (held.length > 0) {
          if (!target) return error(409, 'shelf_not_empty', { bookCount: held.length });
          if (target === shelf.id || !shelves.some((s) => s.id === target))
            return error(422, 'unknown_shelf');
          held.forEach((b) => (b.shelfId = target));
        }
        shelves.splice(shelves.indexOf(shelf), 1);
        return json({ movedBooks: held.length });
      }
    }

    // Lendings
    if (path === '/api/lendings' && method === 'GET') {
      const flag = (name: string) => (q.has(name) ? q.get(name) === 'true' : undefined);
      const active = flag('active') ?? true;
      return json({
        items: listLendings({
          active: flag('overdue') ? true : active,
          overdue: flag('overdue'),
          bookId: q.get('bookId') ?? undefined,
        }),
      });
    }
    if (path === '/api/lendings' && method === 'POST') {
      const input = body as { bookId: string; borrowerName: string } & Partial<Lending>;
      if (!books.some((b) => b.id === input.bookId)) return error(422, 'unknown_book');
      const open = lendings.find((l) => l.bookId === input.bookId && l.returnedAt === null);
      if (open) {
        return error(409, 'already_lent', { lendingId: open.id, borrowerName: open.borrowerName });
      }
      return json(withBook(addLending(input)), 201);
    }
    if (path === '/api/lendings/borrowers') {
      const seen = new Map<string, { name: string; contact: string | null; lastLentAt: string }>();
      for (const l of listLendings({})) {
        const key = l.borrowerName.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, { name: l.borrowerName, contact: l.borrowerContact, lastLentAt: l.lentAt });
        }
      }
      return json({ items: [...seen.values()] });
    }
    if ((m = match(/^\/api\/lendings\/([^/]+)\/return$/)) && method === 'POST') {
      const lending = lendings.find((l) => l.id === m![1]);
      if (!lending) return error(404, 'not_found');
      if (lending.returnedAt !== null) return error(409, 'already_returned');
      const { returnedAt } = (body ?? {}) as { returnedAt?: string };
      lending.returnedAt = returnedAt ?? now();
      lending.updatedAt = now();
      return json(withBook(lending));
    }
    if ((m = match(/^\/api\/lendings\/([^/]+)$/)) && method === 'GET') {
      const item = lendings.find((l) => l.id === m![1]);
      const full = item ? withBook(item) : null;
      return full ? json(full) : error(404, 'not_found');
    }
    if ((m = match(/^\/api\/books\/([^/]+)\/lendings$/)) && method === 'GET') {
      if (!books.some((b) => b.id === m![1])) return error(404, 'not_found');
      return json({ items: listLendings({ bookId: m[1] }) });
    }

    // Stats: the same shape and rules as apps/api/src/stats.ts.
    if (path === '/api/stats' && method === 'GET') return json(computeStats());

    // Books
    if (path === '/api/books' && method === 'GET') {
      let list = [...books];
      const shelfId = q.get('shelfId');
      const libraryId = q.get('libraryId');
      const readStatus = q.get('readStatus');
      const search = q.get('q')?.toLowerCase();
      if (shelfId) list = list.filter((b) => b.shelfId === shelfId);
      if (libraryId) {
        const own = shelves.filter((s) => s.libraryId === libraryId).map((s) => s.id);
        list = list.filter((b) => own.includes(b.shelfId));
      }
      if (readStatus) list = list.filter((b) => b.readStatus === readStatus);
      const minRating = Number(q.get('minRating') ?? 0);
      if (minRating) list = list.filter((b) => (b.rating ?? 0) >= minRating);
      const rating = Number(q.get('rating') ?? 0);
      if (rating) list = list.filter((b) => b.rating === rating);
      const category = q.get('category');
      if (category) list = list.filter((b) => b.categories.includes(category));
      const author = q.get('author');
      if (author) list = list.filter((b) => b.authors.includes(author));
      const language = q.get('language');
      if (language) list = list.filter((b) => b.language === language);
      const publisher = q.get('publisher');
      if (publisher) list = list.filter((b) => b.publisher === publisher);
      const readFrom = q.get('readFrom');
      if (readFrom) list = list.filter((b) => b.readAt !== null && b.readAt >= readFrom);
      const readTo = q.get('readTo');
      if (readTo) list = list.filter((b) => b.readAt !== null && b.readAt <= readTo);
      if (search) {
        list = list.filter((b) =>
          [
            b.title,
            b.subtitle ?? '',
            ...b.authors,
            b.publisher ?? '',
            b.isbn13 ?? '',
            b.isbn10 ?? '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(search),
        );
      }
      const byAdded = (a: Book, b: Book) =>
        b.addedAt.localeCompare(a.addedAt) || a.title.localeCompare(b.title);
      const nullsLast = (a: string | number | null, b: string | number | null) =>
        Number(a === null) - Number(b === null);
      switch (q.get('sort')) {
        case 'title':
          list.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case 'read':
          list.sort(
            (a, b) =>
              nullsLast(a.readAt, b.readAt) ||
              (b.readAt ?? '').localeCompare(a.readAt ?? '') ||
              byAdded(a, b),
          );
          break;
        case 'rating':
          list.sort(
            (a, b) =>
              nullsLast(a.rating, b.rating) || (b.rating ?? 0) - (a.rating ?? 0) || byAdded(a, b),
          );
          break;
        default:
          list.sort(byAdded);
      }
      const limit = Number(q.get('limit') ?? 50);
      const offset = Number(q.get('offset') ?? 0);
      return json({ items: list.slice(offset, offset + limit), total: list.length, limit, offset });
    }
    if (path === '/api/books' && method === 'POST') {
      const { coverUrl, ...input } = body as Partial<Book> & { title: string };
      if (input.shelfId && !shelves.some((s) => s.id === input.shelfId))
        return error(422, 'unknown_shelf');
      // The real API stores the book and looks for a cover afterwards.
      return json(
        addBook({ ...input, coverPending: Boolean(input.isbn13) || Boolean(coverUrl) }),
        201,
      );
    }
    if ((m = match(/^\/api\/books\/([^/]+)\/move$/))) {
      const book = books.find((b) => b.id === m![1]);
      const { shelfId } = body as { shelfId: string };
      if (!shelves.some((s) => s.id === shelfId)) return error(422, 'unknown_shelf');
      if (!book) return error(404, 'not_found');
      book.shelfId = shelfId;
      return json(book);
    }
    if ((m = match(/^\/api\/books\/([^/]+)$/))) {
      const book = books.find((b) => b.id === m![1]);
      if (!book) return error(404, 'not_found');
      if (method === 'GET') return json(book);
      if (method === 'PATCH') {
        // Same rules as the real API (apps/api/src/inventory.ts).
        const { coverUrl, ...input } = body as Partial<Book>;
        const patch: Partial<Book> = { ...input };
        if (coverUrl === null && book.coverOverride) {
          patch.coverAssetId = null;
          patch.coverOverride = false;
          patch.coverUrl = null;
        }
        if (input.readStatus !== undefined || input.readAt !== undefined) {
          patch.readAt = resolveReadAt(
            input.readStatus ?? book.readStatus,
            input.readAt,
            book.readAt,
          );
        }
        if (input.rating !== undefined) patch.rating = normaliseRating(input.rating) ?? null;
        Object.assign(book, patch, { updatedAt: now() });
        return json(book);
      }
      if (method === 'DELETE') {
        books.splice(books.indexOf(book), 1);
        for (let i = lendings.length - 1; i >= 0; i -= 1) {
          if (lendings[i]!.bookId === book.id) lendings.splice(i, 1);
        }
        return new Response(null, { status: 204 });
      }
    }
    return error(404, 'not_found');
  };

  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      'http://localhost',
    );
    const method = (init?.method ?? 'GET').toUpperCase();
    const body =
      typeof init?.body === 'string'
        ? (JSON.parse(init.body) as unknown)
        : init?.body instanceof FormData
          ? init.body
          : undefined;
    calls.push({ method, path: `${url.pathname}${url.search}`, body });
    if (
      failure &&
      (!failure.matcher.method || failure.matcher.method === method) &&
      (!failure.matcher.path || failure.matcher.path.test(url.pathname))
    ) {
      const status = failure.status;
      failure = null;
      return error(status, 'forced_failure');
    }
    // Yield once so optimistic state is observable before the reply lands.
    await new Promise((r) => setTimeout(r, 0));
    return handle(method, url, body);
  });

  return {
    libraries,
    shelves,
    books,
    lendings,
    calls,
    failNext: (matcher, status = 500) => {
      failure = { matcher, status };
    },
    addLibrary,
    addShelf,
    addBook,
    addLending,
    get drafts() {
      return lookup.drafts;
    },
    set drafts(value) {
      lookup.drafts = value;
    },
    get searchResults() {
      return lookup.searchResults;
    },
    set searchResults(value) {
      lookup.searchResults = value;
    },
    get lookupDown() {
      return lookup.down;
    },
    set lookupDown(value) {
      lookup.down = value;
    },
    uploads,
    get backfill() {
      return covers.backfill;
    },
    set backfill(value) {
      covers.backfill = value;
    },
    get backfillQueued() {
      return covers.backfillQueued;
    },
    set backfillQueued(value) {
      covers.backfillQueued = value;
    },
    setCover,
    get user() {
      return auth.user;
    },
    set user(value) {
      auth.user = value;
    },
    restore: () => spy.mockRestore(),
  };
}

/** A fresh install: "My Library" with a "Default" shelf. */
export function seedFakeApi(api: FakeApi) {
  const library = api.addLibrary('My Library');
  const shelf = api.addShelf(library.id, 'Default');
  return { library, shelf };
}
