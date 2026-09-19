/**
 * Idempotent seed: one local user, a "My Library" library and a "Default"
 * shelf, so a fresh install can add a book without picking anything.
 */
import type { DatabaseAdapter } from './adapters';
import { createRepositories } from './repositories';

export const SEED = {
  user: { displayName: 'Local user' },
  library: { name: 'My Library' },
  shelf: { name: 'Default' },
} as const;

export interface SeedResult {
  created: boolean;
  userId: string;
  libraryId: string;
  shelfId: string;
}

export async function seed(adapter: DatabaseAdapter): Promise<SeedResult> {
  return adapter.kit.transaction(async (tx) => {
    const repos = createRepositories({ ...adapter, kit: tx });
    let created = false;

    let user = await repos.users.findFirst();
    if (!user) {
      user = await repos.users.create({ displayName: SEED.user.displayName });
      created = true;
    }

    let [library] = await repos.libraries.listByOwner(user.id);
    if (!library) {
      library = await repos.libraries.create(user.id, { name: SEED.library.name });
      created = true;
    }

    let [shelf] = await repos.shelves.listByLibrary(user.id, library.id);
    if (!shelf) {
      shelf = await repos.shelves.create(user.id, {
        libraryId: library.id,
        name: SEED.shelf.name,
        sortOrder: 0,
      });
      created = true;
    }

    return { created, userId: user.id, libraryId: library.id, shelfId: shelf.id };
  });
}
