import {
  localDate,
  type Book,
  type BookPage,
  type InventoryDefaults,
  type ShelfWithCount,
} from '@bookguardian/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, json, MISSING_ID, type ErrorBody, type TestApp } from './app';

describe('/api/books', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(async () => {
    await t.cleanup();
  });

  const add = (body: Record<string, unknown>) => json<Book>(t.app, 'POST', '/api/books', body);

  it('adds a book with only a title onto the default shelf', async () => {
    const res = await add({ title: 'Dune' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Dune',
      shelfId: t.base.shelfId,
      ownerId: t.base.userId,
      authors: [],
      categories: [],
      readStatus: 'to_read',
      rating: null,
    });
    expect(res.body.addedAt).toBe(res.body.createdAt);
  });

  it('round-trips every field and rejects invalid input', async () => {
    const full = {
      title: 'Dune',
      subtitle: 'Book one',
      authors: ['Frank Herbert'],
      isbn10: '0441013597',
      isbn13: '9780441013593',
      publisher: 'Ace',
      publishedDate: '1965',
      pages: 412,
      language: 'en',
      categories: ['Science fiction'],
      description: 'Desert planet.',
      notes: 'Gift',
      rating: 5,
      readStatus: 'read',
      readAt: '2020-01-15',
    };
    const res = await add(full);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...full, coverAssetId: null, coverOverride: false });
    // The cascade runs in the background; nothing here is a stored cover URL.
    await t.covers.service.idle();
    const got = await json<Book>(t.app, 'GET', `/api/books/${res.body.id}`);
    expect(got.body).toEqual({ ...res.body, coverPending: false });

    for (const bad of [
      {},
      { title: '' },
      { title: 'X', isbn13: '123' },
      { title: 'X', rating: 6 },
      { title: 'X', rating: -1 },
      { title: 'X', rating: 4.5 },
      { title: 'X', readAt: '15/01/2020' },
      { title: 'X', readStatus: 'read', readAt: '2020-1-2' },
      { title: 'X', coverUrl: 'not a url' },
      { title: 'X', readStatus: 'burned' },
      { title: 'X', pages: -1 },
    ]) {
      const invalid = await json<ErrorBody>(t.app, 'POST', '/api/books', bad);
      expect(invalid.status, JSON.stringify(bad)).toBe(422);
      expect(invalid.body.error.code).toBe('validation_error');
    }

    const unknownShelf = await json<ErrorBody>(t.app, 'POST', '/api/books', {
      title: 'X',
      shelfId: MISSING_ID,
    });
    expect(unknownShelf.status).toBe(422);
    expect(unknownShelf.body.error.code).toBe('unknown_shelf');
  });

  it('updates, moves and deletes a book', async () => {
    const book = (await add({ title: 'Draft' })).body;
    const other = await json<ShelfWithCount>(t.app, 'POST', '/api/shelves', {
      libraryId: t.base.libraryId,
      name: 'Other',
    });

    const patched = await json<Book>(t.app, 'PATCH', `/api/books/${book.id}`, {
      title: 'Final',
      rating: 4,
      readStatus: 'reading',
    });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ title: 'Final', rating: 4, readStatus: 'reading' });

    const badShelf = await json<ErrorBody>(t.app, 'PATCH', `/api/books/${book.id}`, {
      shelfId: MISSING_ID,
    });
    expect(badShelf.status).toBe(422);
    expect(badShelf.body.error.code).toBe('unknown_shelf');

    const moved = await json<Book>(t.app, 'POST', `/api/books/${book.id}/move`, {
      shelfId: other.body.id,
    });
    expect(moved.status).toBe(200);
    expect(moved.body.shelfId).toBe(other.body.id);

    const moveUnknown = await json<ErrorBody>(t.app, 'POST', `/api/books/${book.id}/move`, {
      shelfId: MISSING_ID,
    });
    expect(moveUnknown.status).toBe(422);
    expect(
      (await json(t.app, 'POST', `/api/books/${MISSING_ID}/move`, { shelfId: other.body.id }))
        .status,
    ).toBe(404);

    const gone = await t.app.request(`/api/books/${book.id}`, { method: 'DELETE' });
    expect(gone.status).toBe(204);
    expect((await json(t.app, 'GET', `/api/books/${book.id}`)).status).toBe(404);
    expect((await json(t.app, 'DELETE', `/api/books/${book.id}`)).status).toBe(404);
    expect((await json(t.app, 'PATCH', `/api/books/${book.id}`, { title: 'X' })).status).toBe(404);
  });

  describe('read date', () => {
    const today = localDate();
    const tomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return localDate(d);
    })();
    const patch = (id: string, body: Record<string, unknown>) =>
      json<Book>(t.app, 'PATCH', `/api/books/${id}`, body);

    it('stamps today when a book is marked read without a date, keeps an explicit one', async () => {
      const book = (await add({ title: 'Dune' })).body;
      expect(book).toMatchObject({ readStatus: 'to_read', readAt: null });

      const read = await patch(book.id, { readStatus: 'read' });
      expect(read.status).toBe(200);
      expect(read.body).toMatchObject({ readStatus: 'read', readAt: today });

      // Re-sending the status does not move an existing date.
      const again = await patch(book.id, { readStatus: 'read' });
      expect(again.body.readAt).toBe(today);

      const corrected = await patch(book.id, { readAt: '2020-01-15' });
      expect(corrected.status).toBe(200);
      expect(corrected.body).toMatchObject({ readStatus: 'read', readAt: '2020-01-15' });

      const inOneGo = await patch(book.id, { readStatus: 'read', readAt: '2021-06-30' });
      expect(inOneGo.body.readAt).toBe('2021-06-30');
      expect((await json<Book>(t.app, 'GET', `/api/books/${book.id}`)).body.readAt).toBe(
        '2021-06-30',
      );
    });

    it('clears the date when the book goes back to reading / to read', async () => {
      const book = (await add({ title: 'Dune', readStatus: 'read', readAt: '2020-01-15' })).body;
      expect(book.readAt).toBe('2020-01-15');

      const reading = await patch(book.id, { readStatus: 'reading' });
      expect(reading.body).toMatchObject({ readStatus: 'reading', readAt: null });

      // A date only makes sense on a finished book; on any other status it is dropped.
      const stray = await patch(book.id, { readAt: '2020-01-15' });
      expect(stray.status).toBe(200);
      expect(stray.body.readAt).toBeNull();
      const toRead = await patch(book.id, { readStatus: 'to_read', readAt: '2020-01-15' });
      expect(toRead.body).toMatchObject({ readStatus: 'to_read', readAt: null });
    });

    it('applies the same rule on create', async () => {
      const stamped = (await add({ title: 'A', readStatus: 'read' })).body;
      expect(stamped.readAt).toBe(today);
      const unread = (await add({ title: 'B', readStatus: 'reading', readAt: '2020-01-15' })).body;
      expect(unread.readAt).toBeNull();
    });

    it('rejects future dates with the shared validation rule', async () => {
      const book = (await add({ title: 'Dune' })).body;
      for (const body of [{ readStatus: 'read', readAt: tomorrow }, { readAt: '2999-01-01' }]) {
        const res = await json<ErrorBody>(t.app, 'PATCH', `/api/books/${book.id}`, body);
        expect(res.status, JSON.stringify(body)).toBe(422);
        expect(res.body.error.code).toBe('validation_error');
      }
      const create = await json<ErrorBody>(t.app, 'POST', '/api/books', {
        title: 'X',
        readStatus: 'read',
        readAt: tomorrow,
      });
      expect(create.status).toBe(422);
      // Nothing was written.
      expect((await json<Book>(t.app, 'GET', `/api/books/${book.id}`)).body.readAt).toBeNull();
    });
  });

  it('never exposes another owner’s books', async () => {
    const other = await t.repos.users.create({ displayName: 'Other' });
    const lib = await t.repos.libraries.create(other.id, { name: 'Theirs' });
    const shelf = await t.repos.shelves.create(other.id, { libraryId: lib.id, name: 'S' });
    const theirs = await t.repos.books.create(other.id, { shelfId: shelf.id, title: 'Secret' });

    expect((await json(t.app, 'GET', `/api/books/${theirs.id}`)).status).toBe(404);
    const list = await json<BookPage>(t.app, 'GET', '/api/books');
    expect(list.body.items).toEqual([]);
    const onto = await json<ErrorBody>(t.app, 'POST', '/api/books', {
      title: 'Mine',
      shelfId: shelf.id,
    });
    expect(onto.status).toBe(422);
  });

  describe('rating', () => {
    const patch = (id: string, body: Record<string, unknown>) =>
      json<Book>(t.app, 'PATCH', `/api/books/${id}`, body);

    it('stores a 0-star rating as unrated and accepts 1–5', async () => {
      const book = (await add({ title: 'Dune', rating: 0 })).body;
      expect(book.rating).toBeNull();
      expect((await patch(book.id, { rating: 3 })).body.rating).toBe(3);
      expect((await patch(book.id, { rating: 5 })).body.rating).toBe(5);
      expect((await patch(book.id, { rating: 0 })).body.rating).toBeNull();
      expect((await patch(book.id, { rating: 2 })).body.rating).toBe(2);
      expect((await patch(book.id, { rating: null })).body.rating).toBeNull();
      // Unrelated edits leave the rating alone.
      expect((await patch(book.id, { rating: 4 })).body.rating).toBe(4);
      expect((await patch(book.id, { title: 'Dune Messiah' })).body.rating).toBe(4);
      for (const rating of [6, -1, 2.5, 'four']) {
        const bad = await json<ErrorBody>(t.app, 'PATCH', `/api/books/${book.id}`, { rating });
        expect(bad.status, String(rating)).toBe(422);
        expect(bad.body.error.code).toBe('validation_error');
      }
      expect((await json(t.app, 'PATCH', `/api/books/${MISSING_ID}`, { rating: 1 })).status).toBe(
        404,
      );
    });
  });

  describe('listing', () => {
    let second: ShelfWithCount;
    let otherLibraryShelf: ShelfWithCount;

    beforeEach(async () => {
      second = (
        await json<ShelfWithCount>(t.app, 'POST', '/api/shelves', {
          libraryId: t.base.libraryId,
          name: 'Second',
        })
      ).body;
      const lib = await t.repos.libraries.create(t.base.userId, { name: 'Office' });
      otherLibraryShelf = {
        ...(await t.repos.shelves.create(t.base.userId, { libraryId: lib.id, name: 'Desk' })),
        bookCount: 0,
      };
      const seedBooks: Record<string, unknown>[] = [
        {
          title: 'Dune',
          authors: ['Frank Herbert'],
          categories: ['Sci-Fi'],
          readStatus: 'read',
          readAt: '2024-03-01',
          rating: 5,
        },
        {
          title: 'Emma',
          authors: ['Jane Austen'],
          categories: ['Classics'],
          readStatus: 'reading',
          rating: 3,
        },
        {
          title: 'Neuromancer',
          authors: ['William Gibson'],
          categories: ['Sci-Fi', 'Cyberpunk'],
          isbn13: '9780441569595',
          shelfId: second.id,
          readStatus: 'read',
          readAt: '2024-06-15',
        },
        { title: 'Zorba', publisher: 'Faber', shelfId: otherLibraryShelf.id, rating: 4 },
      ];
      for (const body of seedBooks) {
        expect((await add(body)).status).toBe(201);
        await new Promise((r) => setTimeout(r, 2)); // distinct addedAt
      }
    });

    const titles = async (query: string) => {
      const res = await json<BookPage>(t.app, 'GET', `/api/books${query}`);
      expect(res.status).toBe(200);
      return { titles: res.body.items.map((b) => b.title), total: res.body.total, body: res.body };
    };

    it('returns newest first with paging metadata', async () => {
      const all = await titles('');
      expect(all.titles).toEqual(['Zorba', 'Neuromancer', 'Emma', 'Dune']);
      expect(all.body).toMatchObject({ total: 4, limit: 50, offset: 0 });

      const page = await titles('?limit=2&offset=1');
      expect(page.titles).toEqual(['Neuromancer', 'Emma']);
      expect(page.body).toMatchObject({ total: 4, limit: 2, offset: 1 });

      expect((await titles('?sort=title')).titles).toEqual([
        'Dune',
        'Emma',
        'Neuromancer',
        'Zorba',
      ]);
    });

    it('searches title, author, publisher and ISBN case-insensitively', async () => {
      expect((await titles('?q=DUNE')).titles).toEqual(['Dune']);
      expect((await titles('?q=austen')).titles).toEqual(['Emma']);
      expect((await titles('?q=faber')).titles).toEqual(['Zorba']);
      expect((await titles('?q=9780441569595')).titles).toEqual(['Neuromancer']);
      expect((await titles('?q=%25')).total).toBe(0); // wildcard is matched literally
      expect((await titles('?q=_')).total).toBe(0);
      expect((await titles('?q=nothing')).titles).toEqual([]);
    });

    it('filters by shelf, library, read status and category', async () => {
      expect((await titles(`?shelfId=${second.id}`)).titles).toEqual(['Neuromancer']);
      const inLibrary = await titles(`?libraryId=${t.base.libraryId}`);
      expect(inLibrary.titles).toEqual(['Neuromancer', 'Emma', 'Dune']);
      expect(inLibrary.total).toBe(3);
      expect((await titles(`?libraryId=${MISSING_ID}`)).titles).toEqual([]);
      expect((await titles('?readStatus=read')).titles).toEqual(['Neuromancer', 'Dune']);
      expect((await titles('?readStatus=to_read')).titles).toEqual(['Zorba']);
      expect((await titles('?category=Sci-Fi')).titles).toEqual(['Neuromancer', 'Dune']);
      expect((await titles('?category=sci-fi')).titles).toEqual(['Neuromancer', 'Dune']);
      expect((await titles('?category=Sci')).titles).toEqual([]);
      expect((await titles('?category=Cyberpunk&q=gibson&readStatus=read')).titles).toEqual([
        'Neuromancer',
      ]);
      expect((await json(t.app, 'GET', '/api/books?readStatus=nope')).status).toBe(422);
      expect((await json(t.app, 'GET', '/api/books?limit=0')).status).toBe(422);
    });

    it('filters by minimum rating and sorts by rating or recently read', async () => {
      expect((await titles('?minRating=4')).titles).toEqual(['Zorba', 'Dune']);
      expect((await titles('?minRating=5')).titles).toEqual(['Dune']);
      expect((await titles('?minRating=1')).titles).toEqual(['Zorba', 'Emma', 'Dune']);
      expect((await titles('?minRating=3&readStatus=reading')).titles).toEqual(['Emma']);
      expect((await json(t.app, 'GET', '/api/books?minRating=0')).status).toBe(422);
      expect((await json(t.app, 'GET', '/api/books?minRating=6')).status).toBe(422);

      // Best first, unrated last.
      expect((await titles('?sort=rating')).titles).toEqual([
        'Dune',
        'Zorba',
        'Emma',
        'Neuromancer',
      ]);
      // Most recently finished first, never-finished last (newest added among them first).
      expect((await titles('?sort=read')).titles).toEqual(['Neuromancer', 'Dune', 'Zorba', 'Emma']);
      expect((await titles('?sort=read&readStatus=read')).titles).toEqual(['Neuromancer', 'Dune']);
      expect((await json(t.app, 'GET', '/api/books?sort=pages')).status).toBe(422);
    });
  });

  describe('GET /api/defaults', () => {
    it('points at the seeded shelf on a fresh install', async () => {
      const res = await json<InventoryDefaults>(t.app, 'GET', '/api/defaults');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ libraryId: t.base.libraryId, shelfId: t.base.shelfId });
    });

    it('follows the most recently used shelf', async () => {
      const lib = await t.repos.libraries.create(t.base.userId, { name: 'Office' });
      const desk = await t.repos.shelves.create(t.base.userId, { libraryId: lib.id, name: 'Desk' });
      await add({ title: 'First' });
      await new Promise((r) => setTimeout(r, 2));
      await add({ title: 'Second', shelfId: desk.id });

      const res = await json<InventoryDefaults>(t.app, 'GET', '/api/defaults');
      expect(res.body).toEqual({ libraryId: lib.id, shelfId: desk.id });

      // A title-only add now lands on the desk, without touching any picker.
      const third = await add({ title: 'Third' });
      expect(third.body.shelfId).toBe(desk.id);
    });
  });
});

describe('owner resolution', () => {
  it('seeds the local user, library and shelf on first contact with an empty database', async () => {
    const t = await createTestApp();
    try {
      // Wipe the seed to simulate a database that was migrated but never seeded.
      await t.db.adapter.kit.delete(
        t.db.adapter.tables.users,
        (await import('drizzle-orm')).sql`1 = 1`,
      );
      expect(await t.repos.users.findFirst()).toBeNull();

      const res = await json<Book>(t.app, 'POST', '/api/books', { title: 'Hello' });
      expect(res.status).toBe(201);
      const user = await t.repos.users.findFirst();
      expect(user).not.toBeNull();
      expect(res.body.ownerId).toBe(user!.id);
      const libraries = await t.repos.libraries.listByOwner(user!.id);
      expect(libraries.map((l) => l.name)).toEqual(['My Library']);
    } finally {
      await t.cleanup();
    }
  });
});
