/**
 * In-memory stand-in for the inventory API, mounted on `globalThis.fetch`.
 * Mirrors the routes, defaults and cascade rules the real Hono app exposes so
 * screens can be exercised end-to-end without a database.
 */
import {
  applyReadingRules,
  normaliseRating,
  todayIso,
  type Book,
  type BookDraft,
  type LibraryWithCounts,
  type ShelfWithCount,
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
  /** Every request seen, oldest first. */
  calls: { method: string; path: string; body?: unknown }[];
  /** Make the next matching request fail with this status. */
  failNext(matcher: { method?: string; path?: RegExp }, status?: number): void;
  /** Catalogue stand-in for `/api/lookup/*`: drafts by ISBN-13 and free-text results. */
  drafts: Record<string, BookDraft>;
  searchResults: BookDraft[];
  /** Answer every lookup with 503 (providers down). */
  lookupDown: boolean;
  addLibrary(name: string, location?: string | null): Library;
  addShelf(libraryId: string, name: string, sortOrder?: number): Shelf;
  addBook(input: Partial<Book> & { title: string; shelfId?: string }): Book;
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
  const calls: FakeApi['calls'] = [];
  let failure: { matcher: { method?: string; path?: RegExp }; status: number } | null = null;
  const lookup = {
    drafts: {} as Record<string, BookDraft>,
    searchResults: [] as BookDraft[],
    down: false,
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
      coverUrl: null,
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

  const handle = (method: string, url: URL, body: unknown): Response => {
    const path = url.pathname;
    const q = url.searchParams;
    const match = (re: RegExp) => re.exec(path);
    let m: RegExpExecArray | null;

    if (path === '/api/health')
      return json({
        status: 'ok',
        version: 't',
        uptimeSeconds: 0,
        database: { driver: 'sqlite', reachable: true },
      });
    if (path === '/api/defaults') return json(defaults());

    // Lookup
    if (path.startsWith('/api/lookup/')) {
      if (lookup.down) return error(503, 'lookup_unavailable');
      if ((m = match(/^\/api\/lookup\/isbn\/([^/]+)$/))) {
        const draft = lookup.drafts[m[1]!];
        return draft ? json(draft) : error(404, 'isbn_not_found', { isbn: m[1] });
      }
      if (path === '/api/lookup/search') {
        const needle = q.get('q')?.toLowerCase() ?? '';
        const limit = Number(q.get('limit') ?? 5);
        const items = lookup.searchResults
          .filter((d) => [d.title, ...d.authors].join(' ').toLowerCase().includes(needle))
          .slice(0, limit);
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
      const input = body as Partial<Book> & { title: string };
      if (input.shelfId && !shelves.some((s) => s.id === input.shelfId))
        return error(422, 'unknown_shelf');
      return json(addBook(input), 201);
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
        // Same reading rules as the real API (apps/api/src/inventory.ts).
        const input = body as Partial<Book>;
        const reading = applyReadingRules(book, input, todayIso());
        if (!reading.ok) return error(422, 'invalid_reading_dates', { reason: reading.error });
        const rating = normaliseRating(input.rating);
        Object.assign(book, input, reading.value, rating === undefined ? {} : { rating }, {
          updatedAt: now(),
        });
        return json(book);
      }
      if (method === 'DELETE') {
        books.splice(books.indexOf(book), 1);
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
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
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
    calls,
    failNext: (matcher, status = 500) => {
      failure = { matcher, status };
    },
    addLibrary,
    addShelf,
    addBook,
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
    restore: () => spy.mockRestore(),
  };
}

/** A fresh install: "My Library" with a "Default" shelf. */
export function seedFakeApi(api: FakeApi) {
  const library = api.addLibrary('My Library');
  const shelf = api.addShelf(library.id, 'Default');
  return { library, shelf };
}
