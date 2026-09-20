/**
 * Idempotent development seed: makes sure the first user has "My Library"
 * with a "Default" shelf, so an install can add a book without picking
 * anything.
 *
 * Since accounts arrived (BOOK-13) the seed no longer invents a user on its
 * own: people come in through Google and `provisionUser` gives each new
 * account its defaults in the same transaction that creates it. `localUser:
 * true` still creates the email-less "Local user" — tests and `pnpm db:seed
 * --local-user` in development use it, and the first Google sign-in claims
 * that user together with its library (see `auth/account.ts`).
 */
import { DEFAULT_LIBRARY_NAME, DEFAULT_SHELF_NAME, provisionUser } from '../provisioning';
import type { DatabaseAdapter } from './adapters';
import { createRepositories } from './repositories';

export const SEED = {
  user: { displayName: 'Local user' },
  library: { name: DEFAULT_LIBRARY_NAME },
  shelf: { name: DEFAULT_SHELF_NAME },
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

    const provisioned = await provisionUser(repos, user.id);
    return {
      created: created || provisioned.created,
      userId: user.id,
      libraryId: provisioned.libraryId,
      shelfId: provisioned.shelfId,
    };
  });
}

/** `seed()` for callers that must end up with a user (tests, `--local-user`). */
export async function seedLocalUser(adapter: DatabaseAdapter): Promise<SeedResult> {
  const result = await seed(adapter, { localUser: true });
  // `localUser: true` never yields null; the guard keeps the return type honest.
  if (!result) throw new Error('seed: local user could not be created');
  return result;
}
