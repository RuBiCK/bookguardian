import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { likePattern } from '../src/db/adapters/types';
import { createRepositories, type Repositories } from '../src/db/repositories';
import { seed, type SeedResult } from '../src/db/seed';
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
    base = await seed(db.adapter);
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
