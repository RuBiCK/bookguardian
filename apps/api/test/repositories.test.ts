import { afterEach, beforeEach, expect, it } from 'vitest';
import { createRepositories, type Repositories } from '../src/db/repositories';
import { seed, type SeedResult } from '../src/db/seed';
import { describeEachAdapter, expectDbError, type TestDb } from './adapters';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describeEachAdapter('repositories', (adapterCase) => {
  let db: TestDb;
  let repos: Repositories;
  let base: SeedResult;

  beforeEach(async () => {
    db = await adapterCase.create();
    repos = createRepositories(db.adapter);
    base = await seed(db.adapter);
  });
  afterEach(async () => {
    await db.cleanup();
  });

  it('users: creates with generated id and timestamps, finds by id', async () => {
    const user = await repos.users.create({ displayName: 'Ada', email: 'ada@example.com' });
    expect(user.id).toMatch(UUID_RE);
    expect(user.createdAt).toMatch(ISO_RE);
    expect(user.updatedAt).toBe(user.createdAt);
    expect(await repos.users.findById(user.id)).toEqual(user);
    expect(await repos.users.findById('00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('libraries: CRUD scoped to owner, ordered by creation', async () => {
    const second = await repos.libraries.create(base.userId, {
      name: 'Office',
      location: 'Desk',
    });
    const listed = await repos.libraries.listByOwner(base.userId);
    expect(listed.map((l) => l.name)).toEqual(['My Library', 'Office']);

    const updated = await repos.libraries.update(base.userId, second.id, { location: 'Shelf' });
    expect(updated).toMatchObject({ id: second.id, name: 'Office', location: 'Shelf' });
    expect(updated!.updatedAt >= second.updatedAt).toBe(true);

    const stranger = await repos.users.create({ displayName: 'Stranger' });
    expect(await repos.libraries.findById(stranger.id, second.id)).toBeNull();
    expect(await repos.libraries.update(stranger.id, second.id, { name: 'Hijacked' })).toBeNull();
    expect((await repos.libraries.findById(base.userId, second.id))!.name).toBe('Office');

    await repos.libraries.delete(base.userId, second.id);
    expect(await repos.libraries.findById(base.userId, second.id)).toBeNull();
  });

  it('shelves: ordered by sort order then creation, updatable, deletable', async () => {
    const b = await repos.shelves.create(base.userId, {
      libraryId: base.libraryId,
      name: 'B',
      sortOrder: 2,
    });
    const a = await repos.shelves.create(base.userId, {
      libraryId: base.libraryId,
      name: 'A',
      sortOrder: 1,
    });
    const noOrder = await repos.shelves.create(base.userId, {
      libraryId: base.libraryId,
      name: 'Unsorted',
    });
    expect(noOrder.sortOrder).toBe(0);

    const listed = await repos.shelves.listByLibrary(base.userId, base.libraryId);
    expect(listed.map((s) => s.name)).toEqual(['Default', 'Unsorted', 'A', 'B']);

    await repos.shelves.update(base.userId, b.id, { sortOrder: 0, name: 'B2' });
    expect((await repos.shelves.findById(base.userId, b.id))!).toMatchObject({
      name: 'B2',
      sortOrder: 0,
    });

    await repos.shelves.delete(base.userId, a.id);
    expect(await repos.shelves.findById(base.userId, a.id)).toBeNull();
  });

  it('books: round-trips every column including JSON arrays and nulls', async () => {
    const created = await repos.books.create(base.userId, {
      shelfId: base.shelfId,
      title: 'Dune',
      subtitle: 'Book one',
      authors: ['Frank Herbert'],
      categories: ['Science fiction', 'Classics'],
      isbn10: '0441013597',
      isbn13: '9780441013593',
      publisher: 'Ace',
      publishedDate: '1965',
      pages: 412,
      language: 'en',
      coverUrl: 'https://covers.example.com/dune.jpg',
      description: 'Desert planet.',
      notes: 'Gift from Ana',
      rating: 5,
      readStatus: 'read',
      readAt: '2020-01-15',
    });
    expect(created.id).toMatch(UUID_RE);
    expect(created.addedAt).toBe(created.createdAt);

    const found = await repos.books.findById(base.userId, created.id);
    expect(found).toEqual(created);
    expect(found?.authors).toEqual(['Frank Herbert']);
    expect(found?.categories).toEqual(['Science fiction', 'Classics']);

    const minimal = await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'Min' });
    expect(minimal).toMatchObject({
      authors: [],
      categories: [],
      isbn10: null,
      isbn13: null,
      pages: null,
      rating: null,
      readStatus: 'to_read',
      readAt: null,
    });
    expect(await repos.books.findById(base.userId, minimal.id)).toEqual(minimal);
  });

  it('books: update, list by owner (newest first, paginated) and by shelf, delete', async () => {
    const titles = ['One', 'Two', 'Three'];
    const created = [];
    for (const title of titles) {
      created.push(await repos.books.create(base.userId, { shelfId: base.shelfId, title }));
      await new Promise((r) => setTimeout(r, 2)); // distinct addedAt
    }
    const other = await repos.shelves.create(base.userId, {
      libraryId: base.libraryId,
      name: 'Other',
    });
    await repos.books.create(base.userId, { shelfId: other.id, title: 'Elsewhere' });

    const all = await repos.books.listByOwner(base.userId);
    expect(all.map((b) => b.title)).toEqual(['Elsewhere', 'Three', 'Two', 'One']);
    const page = await repos.books.listByOwner(base.userId, { limit: 2, offset: 1 });
    expect(page.map((b) => b.title)).toEqual(['Three', 'Two']);
    expect((await repos.books.listByShelf(base.userId, other.id)).map((b) => b.title)).toEqual([
      'Elsewhere',
    ]);

    const target = created[0]!;
    const updated = await repos.books.update(base.userId, target.id, {
      rating: 4,
      readStatus: 'reading',
      authors: ['Someone'],
    });
    expect(updated).toMatchObject({ rating: 4, readStatus: 'reading', authors: ['Someone'] });
    expect(updated!.updatedAt >= target.updatedAt).toBe(true);

    await repos.books.delete(base.userId, target.id);
    expect(await repos.books.findById(base.userId, target.id)).toBeNull();
    expect(await repos.books.listByOwner(base.userId)).toHaveLength(3);
  });

  it('books: reads and writes are scoped by owner', async () => {
    const other = await repos.users.create({ displayName: 'Someone else' });
    const book = await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'Mine' });

    expect(await repos.books.findById(other.id, book.id)).toBeNull();
    expect(await repos.books.listByOwner(other.id)).toEqual([]);
    expect(await repos.books.update(other.id, book.id, { title: 'Stolen' })).toBeNull();
    await repos.books.delete(other.id, book.id);
    expect((await repos.books.findById(base.userId, book.id))!.title).toBe('Mine');
  });

  it('lendings: create, list open/by book, mark returned, delete', async () => {
    const book = await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'Lent' });
    const first = await repos.lendings.create(base.userId, {
      bookId: book.id,
      borrowerName: 'Ana',
      dueAt: '2026-10-01',
    });
    expect(first).toMatchObject({
      borrowerContact: null,
      dueAt: '2026-10-01',
      returnedAt: null,
    });
    expect(first.lentAt).toMatch(ISO_RE);

    const explicit = await repos.lendings.create(base.userId, {
      bookId: book.id,
      borrowerName: 'Bo',
      borrowerContact: '+34 600 000 000',
      lentAt: '2026-01-01T10:00:00.000Z',
    });
    expect(explicit.lentAt).toBe('2026-01-01T10:00:00.000Z');

    expect((await repos.lendings.listOpen(base.userId)).map((l) => l.borrowerName)).toEqual([
      'Ana',
      'Bo',
    ]);
    expect(await repos.lendings.listByBook(base.userId, book.id)).toHaveLength(2);

    const returned = await repos.lendings.markReturned(
      base.userId,
      first.id,
      '2026-09-01T00:00:00.000Z',
    );
    expect(returned?.returnedAt).toBe('2026-09-01T00:00:00.000Z');
    expect((await repos.lendings.listOpen(base.userId)).map((l) => l.borrowerName)).toEqual(['Bo']);

    const returnedNow = await repos.lendings.markReturned(base.userId, explicit.id);
    expect(returnedNow?.returnedAt).toMatch(ISO_RE);
    expect(await repos.lendings.listOpen(base.userId)).toEqual([]);

    await repos.lendings.delete(base.userId, first.id);
    expect(await repos.lendings.findById(base.userId, first.id)).toBeNull();
    expect(await repos.lendings.findById(base.userId, explicit.id)).not.toBeNull();
  });

  it('lendings: active-by-book, open-by-books, filtered list and borrowers', async () => {
    const dune = await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'Dune' });
    const emma = await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'Emma' });
    const idle = await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'Idle' });
    expect(await repos.lendings.findActiveByBook(base.userId, dune.id)).toBeNull();

    const old = await repos.lendings.create(base.userId, {
      bookId: dune.id,
      borrowerName: 'Ana',
      lentAt: '2026-01-01T00:00:00.000Z',
    });
    await repos.lendings.markReturned(base.userId, old.id, '2026-01-15T00:00:00.000Z');
    const current = await repos.lendings.create(base.userId, {
      bookId: dune.id,
      borrowerName: 'bo',
      borrowerContact: 'bo@example.com',
      lentAt: '2026-02-01T00:00:00.000Z',
    });
    const other = await repos.lendings.create(base.userId, {
      bookId: emma.id,
      borrowerName: 'Bo',
      lentAt: '2026-03-01T00:00:00.000Z',
    });

    expect((await repos.lendings.findActiveByBook(base.userId, dune.id))?.id).toBe(current.id);
    expect(
      (await repos.lendings.listOpenByBooks(base.userId, [dune.id, emma.id, idle.id])).map(
        (l) => l.id,
      ),
    ).toEqual([other.id, current.id]);
    expect(await repos.lendings.listOpenByBooks(base.userId, [])).toEqual([]);

    expect((await repos.lendings.list(base.userId)).map((l) => l.id)).toEqual([
      other.id,
      current.id,
      old.id,
    ]);
    expect((await repos.lendings.list(base.userId, { active: false })).map((l) => l.id)).toEqual([
      old.id,
    ]);
    expect(
      (await repos.lendings.list(base.userId, { active: true, bookId: dune.id })).map((l) => l.id),
    ).toEqual([current.id]);

    // Distinct by name (case-folded), most recent first, latest contact kept.
    expect(await repos.lendings.listBorrowers(base.userId)).toEqual([
      { name: 'Bo', contact: null, lastLentAt: '2026-03-01T00:00:00.000Z' },
      { name: 'Ana', contact: null, lastLentAt: '2026-01-01T00:00:00.000Z' },
    ]);

    // Books by id set, owner-scoped.
    const found = await repos.books.findByIds(base.userId, [
      dune.id,
      idle.id,
      '00000000-0000-4000-8000-000000000000',
    ]);
    expect(found.map((b) => b.title).sort()).toEqual(['Dune', 'Idle']);
    expect(await repos.books.findByIds(base.userId, [])).toEqual([]);
    const other2 = await repos.users.create({ displayName: 'Other' });
    expect(await repos.books.findByIds(other2.id, [dune.id])).toEqual([]);
    expect(await repos.lendings.findActiveByBook(other2.id, dune.id)).toBeNull();
  });

  it('library shares: viewer-only, unique per grantee, listable both ways, revocable', async () => {
    const friend = await repos.users.create({ displayName: 'Friend' });
    const share = await repos.libraryShares.create({
      libraryId: base.libraryId,
      granteeId: friend.id,
    });
    expect(share.role).toBe('viewer');

    expect(await repos.libraryShares.listByGrantee(friend.id)).toEqual([share]);
    expect(await repos.libraryShares.listByLibrary(base.libraryId)).toEqual([share]);

    await expectDbError(
      repos.libraryShares.create({ libraryId: base.libraryId, granteeId: friend.id }),
      /unique|duplicate/i,
    );

    await repos.libraryShares.delete(base.libraryId, friend.id);
    expect(await repos.libraryShares.listByGrantee(friend.id)).toEqual([]);
  });

  it('cascades deletes from library to shelves, books and lendings', async () => {
    const book = await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'Gone' });
    await repos.lendings.create(base.userId, { bookId: book.id, borrowerName: 'Ana' });
    await repos.libraries.delete(base.userId, base.libraryId);
    expect(await repos.shelves.listByLibrary(base.userId, base.libraryId)).toEqual([]);
    expect(await repos.books.listByOwner(base.userId)).toEqual([]);
    expect(await repos.lendings.listOpen(base.userId)).toEqual([]);
  });

  it('transactions roll back on error', async () => {
    const { kit, tables } = db.adapter;
    await expect(
      kit.transaction(async (tx) => {
        const txRepos = createRepositories({ ...db.adapter, kit: tx });
        await txRepos.users.create({ displayName: 'Ghost' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const users = await kit.select(tables.users);
    expect(users.map((u) => u.displayName)).toEqual(['Local user']);
  });
});
