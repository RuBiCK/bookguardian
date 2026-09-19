import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRepositories } from '../src/db/repositories';
import { seed, SEED } from '../src/db/seed';
import { createTestDb, type TestDb } from './helpers';

describe('seed', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
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
});
