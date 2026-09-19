import type { Book, LibraryWithCounts, ShelfWithCount } from '@bookguardian/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, json, MISSING_ID, type ErrorBody, type TestApp } from './app';

describe('/api/libraries', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(async () => {
    await t.cleanup();
  });

  it('lists the seeded library with shelf and book counts', async () => {
    await t.repos.books.create(t.base.userId, { shelfId: t.base.shelfId, title: 'A' });
    const res = await json<{ items: LibraryWithCounts[] }>(t.app, 'GET', '/api/libraries');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: t.base.libraryId,
      name: 'My Library',
      shelfCount: 1,
      bookCount: 1,
    });
  });

  it('creates, reads, updates and validates a library', async () => {
    const created = await json<LibraryWithCounts>(t.app, 'POST', '/api/libraries', {
      name: '  Office ',
      location: 'Desk',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'Office',
      location: 'Desk',
      shelfCount: 0,
      bookCount: 0,
      ownerId: t.base.userId,
    });

    const got = await json<LibraryWithCounts>(t.app, 'GET', `/api/libraries/${created.body.id}`);
    expect(got.status).toBe(200);
    expect(got.body.id).toBe(created.body.id);

    const patched = await json<LibraryWithCounts>(
      t.app,
      'PATCH',
      `/api/libraries/${created.body.id}`,
      { location: 'Window' },
    );
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ name: 'Office', location: 'Window' });

    const invalid = await json<ErrorBody>(t.app, 'POST', '/api/libraries', { name: '' });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('validation_error');

    const badId = await json<ErrorBody>(t.app, 'GET', '/api/libraries/not-a-uuid');
    expect(badId.status).toBe(422);
  });

  it('returns 404 for unknown or foreign libraries', async () => {
    const other = await t.repos.users.create({ displayName: 'Other' });
    const foreign = await t.repos.libraries.create(other.id, { name: 'Theirs' });
    for (const id of [MISSING_ID, foreign.id]) {
      expect((await json(t.app, 'GET', `/api/libraries/${id}`)).status).toBe(404);
      expect((await json(t.app, 'PATCH', `/api/libraries/${id}`, { name: 'X' })).status).toBe(404);
      expect((await json(t.app, 'DELETE', `/api/libraries/${id}`)).status).toBe(404);
    }
    expect((await t.repos.libraries.findById(other.id, foreign.id))?.name).toBe('Theirs');
  });

  it('refuses to delete the last library', async () => {
    const res = await json<ErrorBody>(t.app, 'DELETE', `/api/libraries/${t.base.libraryId}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('last_library');
  });

  it('deletes an empty library along with its shelves', async () => {
    const lib = await json<LibraryWithCounts>(t.app, 'POST', '/api/libraries', { name: 'Attic' });
    const shelf = await t.repos.shelves.create(t.base.userId, {
      libraryId: lib.body.id,
      name: 'Box',
    });
    const res = await json(t.app, 'DELETE', `/api/libraries/${lib.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ movedBooks: 0 });
    expect(await t.repos.shelves.findById(t.base.userId, shelf.id)).toBeNull();
  });

  it('blocks deleting a library that holds books unless a destination shelf is given', async () => {
    const lib = await json<LibraryWithCounts>(t.app, 'POST', '/api/libraries', { name: 'Attic' });
    const box = await json<ShelfWithCount>(t.app, 'POST', '/api/shelves', {
      libraryId: lib.body.id,
      name: 'Box',
    });
    const book = await json<Book>(t.app, 'POST', '/api/books', {
      title: 'Boxed',
      shelfId: box.body.id,
    });

    const blocked = await json<ErrorBody>(t.app, 'DELETE', `/api/libraries/${lib.body.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatchObject({
      code: 'library_not_empty',
      details: { bookCount: 1 },
    });
    expect((await json(t.app, 'GET', `/api/libraries/${lib.body.id}`)).status).toBe(200);

    // The destination cannot be inside the library being removed.
    const inside = await json<ErrorBody>(
      t.app,
      'DELETE',
      `/api/libraries/${lib.body.id}?moveBooksTo=${box.body.id}`,
    );
    expect(inside.status).toBe(422);
    expect(inside.body.error.code).toBe('unknown_shelf');

    const moved = await json(
      t.app,
      'DELETE',
      `/api/libraries/${lib.body.id}?moveBooksTo=${t.base.shelfId}`,
    );
    expect(moved.status).toBe(200);
    expect(moved.body).toEqual({ movedBooks: 1 });
    expect((await t.repos.books.findById(t.base.userId, book.body.id))?.shelfId).toBe(
      t.base.shelfId,
    );
    expect((await json(t.app, 'GET', `/api/libraries/${lib.body.id}`)).status).toBe(404);
  });
});
