import { afterEach, beforeEach, expect, it } from 'vitest';
import { createRepositories } from '../src/db/repositories';
import { seed, SEED } from '../src/db/seed';
import { describeEachAdapter, type TestDb } from './adapters';

describeEachAdapter('seed', (adapterCase) => {
  let db: TestDb;
  beforeEach(async () => {
    db = await adapterCase.create();
  });
  afterEach(async () => {
    await db.cleanup();
  });

  it('creates one user, "My Library" and a "Default" shelf', async () => {
    const result = await seed(db.adapter);
    expect(result.created).toBe(true);

    const repos = createRepositories(db.adapter);
    const user = await repos.users.findById(result.userId);
    expect(user?.displayName).toBe(SEED.user.displayName);

    const libraries = await repos.libraries.listByOwner(result.userId);
    expect(libraries.map((l) => l.name)).toEqual([SEED.library.name]);

    const shelves = await repos.shelves.listByLibrary(result.userId, result.libraryId);
    expect(shelves.map((s) => s.name)).toEqual([SEED.shelf.name]);
  });

  it('is idempotent', async () => {
    const first = await seed(db.adapter);
    const second = await seed(db.adapter);
    expect(second.created).toBe(false);
    expect(second).toMatchObject({
      userId: first.userId,
      libraryId: first.libraryId,
      shelfId: first.shelfId,
    });
  });

  it('repairs a partially seeded database without duplicating rows', async () => {
    const repos = createRepositories(db.adapter);
    const user = await repos.users.create({ displayName: 'Existing' });
    const result = await seed(db.adapter);
    expect(result).toMatchObject({ created: true, userId: user.id });
    expect(await repos.libraries.listByOwner(user.id)).toHaveLength(1);
    expect(await repos.shelves.listByLibrary(user.id, result.libraryId)).toHaveLength(1);
    expect(await seed(db.adapter)).toMatchObject({ created: false, userId: user.id });
  });
});
