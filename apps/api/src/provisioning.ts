/**
 * Per-user provisioning: every account starts with a "My Library" library
 * holding a "Default" shelf, so adding a book never requires picking either.
 *
 * `provisionUser` runs inside the transaction that creates a user
 * (`auth/account.ts`) and from the development seed. It is idempotent: a
 * user who already owns a library is left alone, whatever they renamed it to.
 *
 * The names are English literals on purpose. The API has no i18n layer (the
 * SPA translates its own strings); these are the user's own rows, editable
 * like any other library or shelf, and the SPA labels the empty state and
 * placeholders through `library.namePlaceholder` / `library.shelfNamePlaceholder`
 * with the same words. Translating the seed names server-side would need the
 * caller's locale at sign-in time, which the OIDC flow does not carry.
 */
import type { Repositories } from './db/repositories';

export const DEFAULT_LIBRARY_NAME = 'My Library';
export const DEFAULT_SHELF_NAME = 'Default';

export interface ProvisionResult {
  /** `true` when a library or shelf had to be created. */
  created: boolean;
  libraryId: string;
  shelfId: string;
}

/**
 * Ensure `userId` has somewhere to put a book. Creates the default library
 * and shelf when the user has no library; adds a shelf when their first
 * library somehow has none. Returns the ids of the first library/shelf.
 */
export async function provisionUser(repos: Repositories, userId: string): Promise<ProvisionResult> {
  let created = false;

  let [library] = await repos.libraries.listByOwner(userId);
  if (!library) {
    library = await repos.libraries.create(userId, { name: DEFAULT_LIBRARY_NAME });
    created = true;
  }

  let [shelf] = await repos.shelves.listByLibrary(userId, library.id);
  if (!shelf) {
    shelf = await repos.shelves.create(userId, {
      libraryId: library.id,
      name: DEFAULT_SHELF_NAME,
      sortOrder: 0,
    });
    created = true;
  }

  return { created, libraryId: library.id, shelfId: shelf.id };
}
