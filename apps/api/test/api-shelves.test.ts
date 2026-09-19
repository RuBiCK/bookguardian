import type { Book, ShelfWithCount } from '@bookguardian/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, json, MISSING_ID, type ErrorBody, type TestApp } from './app';

describe('/api/shelves', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(async () => {
    await t.cleanup();
  });

  it('lists shelves (all, or per library) with book counts', async () => {
    await t.repos.books.create(t.base.userId, { shelfId: t.base.shelfId, title: 'A' });
    await t.repos.books.create(t.base.userId, { shelfId: t.base.shelfId, title: 'B' });
    const other = await t.repos.libraries.create(t.base.userId, { name: 'Other' });
    await t.repos.shelves.create(t.base.userId, { libraryId: other.id, name: 'Elsewhere' });

    const all = await json<{ items: ShelfWithCount[] }>(t.app, 'GET', '/api/shelves');
    expect(all.status).toBe(200);
    expect(all.body.items.map((s) => `${s.name}:${s.bookCount}`).sort()).toEqual([
      'Default:2',
      'Elsewhere:0',
    ]);

    const one = await json<{ items: ShelfWithCount[] }>(
      t.app,
      'GET',
      `/api/shelves?libraryId=${t.base.libraryId}`,
    );
    expect(one.body.items.map((s) => s.name)).toEqual(['Default']);

    expect((await json(t.app, 'GET', `/api/shelves?libraryId=${MISSING_ID}`)).status).toBe(404);
    expect((await json(t.app, 'GET', '/api/shelves?libraryId=x')).status).toBe(422);
  });

  it('creates shelves at the end of the library, then reads and renames them', async () => {
    const a = await json<ShelfWithCount>(t.app, 'POST', '/api/shelves', {
      libraryId: t.base.libraryId,
      name: 'A',
    });
    const b = await json<ShelfWithCount>(t.app, 'POST', '/api/shelves', {
      libraryId: t.base.libraryId,
      name: 'B',
    });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ name: 'A', sortOrder: 1, bookCount: 0 });
    expect(b.body.sortOrder).toBe(2);

    const got = await json<ShelfWithCount>(t.app, 'GET', `/api/shelves/${a.body.id}`);
    expect(got.status).toBe(200);
    expect(got.body).toMatchObject({ id: a.body.id, bookCount: 0 });

    const renamed = await json<ShelfWithCount>(t.app, 'PATCH', `/api/shelves/${a.body.id}`, {
      name: 'Top',
    });
    expect(renamed.body.name).toBe('Top');

    const unknownLibrary = await json<ErrorBody>(t.app, 'POST', '/api/shelves', {
      libraryId: MISSING_ID,
      name: 'Nope',
    });
    expect(unknownLibrary.status).toBe(422);
    expect(unknownLibrary.body.error.code).toBe('unknown_library');

    expect((await json(t.app, 'GET', `/api/shelves/${MISSING_ID}`)).status).toBe(404);
    expect((await json(t.app, 'PATCH', `/api/shelves/${MISSING_ID}`, { name: 'X' })).status).toBe(
      404,
    );
  });

  it('reorders the shelves of a library', async () => {
    const a = await json<ShelfWithCount>(t.app, 'POST', '/api/shelves', {
      libraryId: t.base.libraryId,
      name: 'A',
    });
    const b = await json<ShelfWithCount>(t.app, 'POST', '/api/shelves', {
      libraryId: t.base.libraryId,
      name: 'B',
    });
    const res = await json<{ items: ShelfWithCount[] }>(t.app, 'POST', '/api/shelves/reorder', {
      libraryId: t.base.libraryId,
      shelfIds: [b.body.id, t.base.shelfId, a.body.id],
    });
    expect(res.status).toBe(200);
    expect(res.body.items.map((s) => [s.name, s.sortOrder])).toEqual([
      ['B', 0],
      ['Default', 1],
      ['A', 2],
    ]);

    const partial = await json<ErrorBody>(t.app, 'POST', '/api/shelves/reorder', {
      libraryId: t.base.libraryId,
      shelfIds: [a.body.id],
    });
    expect(partial.status).toBe(422);
    expect(partial.body.error.code).toBe('shelf_mismatch');

    const dupes = await json<ErrorBody>(t.app, 'POST', '/api/shelves/reorder', {
      libraryId: t.base.libraryId,
      shelfIds: [a.body.id, a.body.id, a.body.id],
    });
    expect(dupes.status).toBe(422);
  });

  it('refuses to delete the only shelf of a library', async () => {
    const res = await json<ErrorBody>(t.app, 'DELETE', `/api/shelves/${t.base.shelfId}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('last_shelf');
    expect((await json(t.app, 'DELETE', `/api/shelves/${MISSING_ID}`)).status).toBe(404);
  });

  it('deletes an empty shelf, and a full one only into a destination shelf', async () => {
    const spare = await json<ShelfWithCount>(t.app, 'POST', '/api/shelves', {
      libraryId: t.base.libraryId,
      name: 'Spare',
    });
    const empty = await json(t.app, 'DELETE', `/api/shelves/${spare.body.id}`);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ movedBooks: 0 });

    const full = await json<ShelfWithCount>(t.app, 'POST', '/api/shelves', {
      libraryId: t.base.libraryId,
      name: 'Full',
    });
    const book = await json<Book>(t.app, 'POST', '/api/books', {
      title: 'On full',
      shelfId: full.body.id,
    });

    const blocked = await json<ErrorBody>(t.app, 'DELETE', `/api/shelves/${full.body.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatchObject({
      code: 'shelf_not_empty',
      details: { bookCount: 1 },
    });

    const self = await json<ErrorBody>(
      t.app,
      'DELETE',
      `/api/shelves/${full.body.id}?moveBooksTo=${full.body.id}`,
    );
    expect(self.status).toBe(422);
    const unknown = await json<ErrorBody>(
      t.app,
      'DELETE',
      `/api/shelves/${full.body.id}?moveBooksTo=${MISSING_ID}`,
    );
    expect(unknown.status).toBe(422);
    expect(unknown.body.error.code).toBe('unknown_shelf');

    const moved = await json(
      t.app,
      'DELETE',
      `/api/shelves/${full.body.id}?moveBooksTo=${t.base.shelfId}`,
    );
    expect(moved.status).toBe(200);
    expect(moved.body).toEqual({ movedBooks: 1 });
    expect((await t.repos.books.findById(t.base.userId, book.body.id))?.shelfId).toBe(
      t.base.shelfId,
    );
    expect(await t.repos.shelves.findById(t.base.userId, full.body.id)).toBeNull();
  });
});
