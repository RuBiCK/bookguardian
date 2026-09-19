import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRepositories, type Repositories } from '../src/db/repositories';
import { seed, type SeedResult } from '../src/db/seed';
import { createTestDb, type TestDb } from './helpers';

describe('repositories (sqlite)', () => {
  let db: TestDb;
  let repos: Repositories;
  let base: SeedResult;

  beforeEach(async () => {
    db = await createTestDb();
    repos = createRepositories(db.adapter);
    base = await seed(db.adapter);
  });
  afterEach(async () => {
    await db.cleanup();
  });

  it('round-trips a book including JSON array columns', async () => {
    const created = await repos.books.create(base.userId, {
      shelfId: base.shelfId,
      title: 'Dune',
      authors: ['Frank Herbert'],
      categories: ['Science fiction', 'Classics'],
      isbn13: '9780441013593',
      rating: 5,
      readStatus: 'read',
    });
    const found = await repos.books.findById(base.userId, created.id);
    expect(found).toEqual(created);
    expect(found?.authors).toEqual(['Frank Herbert']);
    expect(found?.categories).toEqual(['Science fiction', 'Classics']);

    const updated = await repos.books.update(base.userId, created.id, { rating: 4 });
    expect(updated?.rating).toBe(4);
    expect((updated?.updatedAt ?? '') >= created.updatedAt).toBe(true);

    expect(await repos.books.listByShelf(base.userId, base.shelfId)).toHaveLength(1);
    await repos.books.delete(base.userId, created.id);
    expect(await repos.books.findById(base.userId, created.id)).toBeNull();
  });

  it('scopes reads and writes by owner', async () => {
    const other = await repos.users.create({ displayName: 'Someone else' });
    const book = await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'Mine' });

    expect(await repos.books.findById(other.id, book.id)).toBeNull();
    await repos.books.delete(other.id, book.id);
    expect(await repos.books.findById(base.userId, book.id)).not.toBeNull();
  });

  it('tracks lendings and returns', async () => {
    const book = await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'Lent' });
    const lending = await repos.lendings.create(base.userId, {
      bookId: book.id,
      borrowerName: 'Ana',
      dueAt: '2026-10-01',
    });
    expect(await repos.lendings.listOpen(base.userId)).toHaveLength(1);

    const returned = await repos.lendings.markReturned(base.userId, lending.id);
    expect(returned?.returnedAt).not.toBeNull();
    expect(await repos.lendings.listOpen(base.userId)).toHaveLength(0);
  });

  it('records read-only library shares', async () => {
    const friend = await repos.users.create({ displayName: 'Friend' });
    await repos.libraryShares.create({ libraryId: base.libraryId, granteeId: friend.id });
    const shares = await repos.libraryShares.listByGrantee(friend.id);
    expect(shares).toHaveLength(1);
    expect(shares[0]?.role).toBe('viewer');

    await expect(
      repos.libraryShares.create({ libraryId: base.libraryId, granteeId: friend.id }),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('cascades deletes from library to shelves and books', async () => {
    await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'Gone' });
    await repos.libraries.delete(base.userId, base.libraryId);
    expect(await repos.shelves.listByLibrary(base.userId, base.libraryId)).toEqual([]);
    expect(await repos.books.listByOwner(base.userId)).toEqual([]);
  });
});
