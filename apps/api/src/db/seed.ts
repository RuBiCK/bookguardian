/**
 * Idempotent seed: a "My Library" library with a "Default" shelf for the
 * first user, so an install can add a book without picking anything.
 *
 * Since accounts arrived (BOOK-13) the seed no longer invents a user on its
 * own: people come in through Google and per-user provisioning gives each
 * account its defaults. `localUser: true` still creates the email-less
 * "Local user" — tests and `pnpm db:seed --local-user` in development use it,
 * and the first Google sign-in claims that user together with its library
 * (see `auth/account.ts`).
 */
import type { DatabaseAdapter } from './adapters';
import { createRepositories } from './repositories';

export const SEED = {
  user: { displayName: 'Local user' },
  library: { name: 'My Library' },
  shelf: { name: 'Default' },
} as const;

export interface SeedOptions {
  /** Create the email-less local user when the database has no user at all. */
  localUser?: boolean;
}

export interface SeedResult {
  created: boolean;
  userId: string;
  libraryId: string;
  shelfId: string;
}

/** Resolves to `null` when there is no user to provision (and `localUser` is not set). */
export async function seed(
  adapter: DatabaseAdapter,
  options: SeedOptions = {},
): Promise<SeedResult | null> {
  return adapter.kit.transaction(async (tx) => {
    const repos = createRepositories({ ...adapter, kit: tx });
    let created = false;

    let user = await repos.users.findFirst();
    if (!user) {
      if (!options.localUser) return null;
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

/** `seed()` for callers that must end up with a user (tests, `--local-user`). */
export async function seedLocalUser(adapter: DatabaseAdapter): Promise<SeedResult> {
  const result = await seed(adapter, { localUser: true });
  // `localUser: true` never yields null; the guard keeps the return type honest.
  if (!result) throw new Error('seed: local user could not be created');
  return result;
}
