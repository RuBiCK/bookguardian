import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { likePattern } from '../src/db/adapters/types';
import { createRepositories, type Repositories } from '../src/db/repositories';
import { seedLocalUser, type SeedResult } from '../src/db/seed';
import { describeEachAdapter, type TestDb } from './adapters';

it('likePattern lower-cases and escapes LIKE wildcards', () => {
  expect(likePattern('Dune')).toBe('%dune%');
  expect(likePattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
});

describeEachAdapter('dialect kit extensions', (adapterCase) => {
  let db: TestDb;
  let repos: Repositories;
  let base: SeedResult;

  beforeEach(async () => {
    db = await adapterCase.create();
    repos = createRepositories(db.adapter);
    base = await seedLocalUser(db.adapter);
  });
  afterEach(async () => {
    await db.cleanup();
  });

  it('count and countBy aggregate with and without a filter', async () => {
    const { kit, tables } = db.adapter;
    const other = await repos.shelves.create(base.userId, {
      libraryId: base.libraryId,
      name: 'Other',
    });
    for (const [title, shelfId] of [
      ['A', base.shelfId],
      ['B', base.shelfId],
      ['C', other.id],
    ] as const) {
      await repos.books.create(base.userId, { shelfId, title });
    }
    expect(await kit.count(tables.books)).toBe(3);
    expect(await kit.count(tables.books, eq(tables.books.shelfId, other.id))).toBe(1);
    expect(await kit.count(tables.lendings)).toBe(0);

    const groups = await kit.countBy(tables.books, tables.books.shelfId);
    expect(groups.sort((a, b) => a.key.localeCompare(b.key))).toEqual(
      [
        { key: base.shelfId, count: 2 },
        { key: other.id, count: 1 },
      ].sort((a, b) => a.key.localeCompare(b.key)),
    );
    expect(
      await kit.countBy(tables.books, tables.books.shelfId, eq(tables.books.shelfId, other.id)),
    ).toEqual([{ key: other.id, count: 1 }]);
  });

  it('countByPrefix, countByJsonArray and sum aggregate for the stats', async () => {
    const { kit, tables } = db.adapter;
    const owned = eq(tables.books.ownerId, base.userId);
    const add = (title: string, extra: Record<string, unknown>) =>
      repos.books.create(base.userId, { shelfId: base.shelfId, title, ...extra });
    await add('A', { readAt: '2026-01-10', authors: ['X', 'Y'], pages: 100 });
    await add('B', { readAt: '2026-01-25', authors: ['X'], pages: 50 });
    await add('C', { readAt: '2025-12-31', authors: [], pages: null });
    await add('D', { readAt: null, authors: ['Z'] });

    const sorted = (groups: { key: string; count: number }[]) =>
      [...groups].sort((a, b) => a.key.localeCompare(b.key));
    // NULLs are left out; the prefix length picks month or year.
    expect(sorted(await kit.countByPrefix(tables.books, tables.books.readAt, 7, owned))).toEqual([
      { key: '2025-12', count: 1 },
      { key: '2026-01', count: 2 },
    ]);
    expect(sorted(await kit.countByPrefix(tables.books, tables.books.readAt, 4))).toEqual([
      { key: '2025', count: 1 },
      { key: '2026', count: 2 },
    ]);
    // One group per array element; a book with two authors counts towards both.
    expect(sorted(await kit.countByJsonArray(tables.books, tables.books.authors, owned))).toEqual([
      { key: 'X', count: 2 },
      { key: 'Y', count: 1 },
      { key: 'Z', count: 1 },
    ]);
    expect(
      await kit.countByJsonArray(tables.books, tables.books.authors, eq(tables.books.title, 'C')),
    ).toEqual([]);
    expect(await kit.sum(tables.books, tables.books.pages, owned)).toBe(150);
    expect(await kit.sum(tables.books, tables.books.pages, eq(tables.books.title, 'D'))).toBe(0);
  });

  it('contains matches case-insensitively and treats wildcards literally', async () => {
    const { kit, tables } = db.adapter;
    await repos.books.create(base.userId, { shelfId: base.shelfId, title: '100% Wool' });
    await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'Under_score' });
    await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'Back\\slash' });
    const find = async (needle: string) =>
      (await kit.select(tables.books, { where: kit.contains(tables.books.title, needle) })).map(
        (b) => b.title,
      );
    expect(await find('wool')).toEqual(['100% Wool']);
    expect(await find('100%')).toEqual(['100% Wool']);
    expect(await find('%')).toEqual(['100% Wool']);
    expect(await find('_')).toEqual(['Under_score']);
    expect(await find('\\')).toEqual(['Back\\slash']);
    expect(await find('zzz')).toEqual([]);
  });

  it('repositories: search, most recent, per-shelf counts, moveAll and reorder', async () => {
    const other = await repos.shelves.create(base.userId, {
      libraryId: base.libraryId,
      name: 'Other',
    });
    const a = await repos.books.create(base.userId, { shelfId: base.shelfId, title: 'A' });
    await new Promise((r) => setTimeout(r, 2));
    const b = await repos.books.create(base.userId, { shelfId: other.id, title: 'B' });

    expect((await repos.books.findMostRecent(base.userId))?.id).toBe(b.id);
    expect(await repos.books.findMostRecent('nobody')).toBeNull();
    expect(await repos.books.countByShelf(base.userId)).toEqual(
      new Map([
        [base.shelfId, 1],
        [other.id, 1],
      ]),
    );
    expect(await repos.books.countByShelf(base.userId, [])).toEqual(new Map());
    expect(await repos.books.search(base.userId, { shelfIds: [] })).toEqual({
      items: [],
      total: 0,
    });
    expect(
      (await repos.books.search(base.userId, { shelfIds: [other.id] })).items.map((x) => x.id),
    ).toEqual([b.id]);

    expect(await repos.books.moveAll(base.userId, [], base.shelfId)).toBe(0);
    expect(await repos.books.moveAll(base.userId, [other.id], base.shelfId)).toBe(1);
    expect(await repos.books.moveAll(base.userId, [other.id], base.shelfId)).toBe(0);
    expect((await repos.books.findById(base.userId, b.id))?.shelfId).toBe(base.shelfId);
    expect((await repos.books.findById(base.userId, a.id))?.shelfId).toBe(base.shelfId);

    await repos.shelves.reorder(base.userId, [other.id, base.shelfId]);
    expect(
      (await repos.shelves.listByLibrary(base.userId, base.libraryId)).map((s) => s.name),
    ).toEqual(['Other', 'Default']);
    expect(await repos.shelves.countByLibrary(base.userId)).toEqual(new Map([[base.libraryId, 2]]));
    expect((await repos.shelves.listByOwner(base.userId)).map((s) => s.name)).toEqual([
      'Other',
      'Default',
    ]);
  });
});
