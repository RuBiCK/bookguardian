/**
 * Inventory use-cases shared by the library / shelf / book routes: counted
 * listings, default-shelf resolution and the cascade rules for deleting
 * containers. Routes validate and translate to HTTP; the rules live here.
 */
import type {
  Book,
  CreateBookRequest,
  InventoryDefaults,
  LibraryWithCounts,
  ShelfWithCount,
} from '@bookguardian/shared';
import type { Services } from './app-env';
import type { DatabaseAdapter } from './db/adapters';
import { createRepositories, type Repositories } from './db/repositories';
import { ApiHttpError } from './errors';

const notFound = (entity: string) => new ApiHttpError(404, 'not_found', `${entity} not found`);

/** Run `fn` with repositories bound to one transaction. */
function transactional<R>(
  adapter: DatabaseAdapter,
  fn: (repos: Repositories) => Promise<R>,
): Promise<R> {
  return adapter.kit.transaction((tx) => fn(createRepositories({ ...adapter, kit: tx })));
}

export async function listLibraries(
  repos: Repositories,
  ownerId: string,
): Promise<LibraryWithCounts[]> {
  const [libraries, shelves, booksPerShelf] = await Promise.all([
    repos.libraries.listByOwner(ownerId),
    repos.shelves.listByOwner(ownerId),
    repos.books.countByShelf(ownerId),
  ]);
  const shelfCount = new Map<string, number>();
  const bookCount = new Map<string, number>();
  for (const shelf of shelves) {
    shelfCount.set(shelf.libraryId, (shelfCount.get(shelf.libraryId) ?? 0) + 1);
    const books = booksPerShelf.get(shelf.id) ?? 0;
    bookCount.set(shelf.libraryId, (bookCount.get(shelf.libraryId) ?? 0) + books);
  }
  return libraries.map((library) => ({
    ...library,
    shelfCount: shelfCount.get(library.id) ?? 0,
    bookCount: bookCount.get(library.id) ?? 0,
  }));
}

export async function getLibrary(
  repos: Repositories,
  ownerId: string,
  id: string,
): Promise<LibraryWithCounts> {
  const library = (await listLibraries(repos, ownerId)).find((l) => l.id === id);
  if (!library) throw notFound('Library');
  return library;
}

export async function listShelves(
  repos: Repositories,
  ownerId: string,
  libraryId?: string,
): Promise<ShelfWithCount[]> {
  if (libraryId && !(await repos.libraries.findById(ownerId, libraryId))) {
    throw notFound('Library');
  }
  const shelves = libraryId
    ? await repos.shelves.listByLibrary(ownerId, libraryId)
    : await repos.shelves.listByOwner(ownerId);
  const counts = await repos.books.countByShelf(
    ownerId,
    shelves.map((s) => s.id),
  );
  return shelves.map((shelf) => ({ ...shelf, bookCount: counts.get(shelf.id) ?? 0 }));
}

export async function getShelf(
  repos: Repositories,
  ownerId: string,
  id: string,
): Promise<ShelfWithCount> {
  const shelf = await repos.shelves.findById(ownerId, id);
  if (!shelf) throw notFound('Shelf');
  const counts = await repos.books.countByShelf(ownerId, [id]);
  return { ...shelf, bookCount: counts.get(id) ?? 0 };
}

/**
 * The shelf a new book lands on when the user does not pick one: wherever
 * the last book went, else the first shelf of the first library.
 */
export async function resolveDefaults(
  repos: Repositories,
  ownerId: string,
): Promise<InventoryDefaults> {
  const recent = await repos.books.findMostRecent(ownerId);
  if (recent) {
    const shelf = await repos.shelves.findById(ownerId, recent.shelfId);
    if (shelf) return { libraryId: shelf.libraryId, shelfId: shelf.id };
  }
  for (const library of await repos.libraries.listByOwner(ownerId)) {
    const [shelf] = await repos.shelves.listByLibrary(ownerId, library.id);
    if (shelf) return { libraryId: library.id, shelfId: shelf.id };
  }
  throw new ApiHttpError(409, 'no_shelf', 'Create a shelf before adding books');
}

export async function createBook(
  repos: Repositories,
  ownerId: string,
  input: CreateBookRequest,
): Promise<Book> {
  const shelfId = input.shelfId ?? (await resolveDefaults(repos, ownerId)).shelfId;
  if (input.shelfId && !(await repos.shelves.findById(ownerId, input.shelfId))) {
    throw new ApiHttpError(422, 'unknown_shelf', 'Shelf not found', { shelfId: input.shelfId });
  }
  return repos.books.create(ownerId, { ...input, shelfId });
}

export async function moveBook(
  repos: Repositories,
  ownerId: string,
  id: string,
  shelfId: string,
): Promise<Book> {
  if (!(await repos.shelves.findById(ownerId, shelfId))) {
    throw new ApiHttpError(422, 'unknown_shelf', 'Shelf not found', { shelfId });
  }
  const book = await repos.books.update(ownerId, id, { shelfId });
  if (!book) throw notFound('Book');
  return book;
}

export interface DeleteContainerResult {
  /** Number of books re-shelved before the delete. */
  movedBooks: number;
}

/**
 * Delete a shelf. Books on it must go somewhere: without `moveBooksTo` a
 * non-empty shelf is refused (409 `shelf_not_empty`). A library always keeps
 * at least one shelf (409 `last_shelf`).
 */
export function deleteShelf(
  services: Services,
  ownerId: string,
  id: string,
  moveBooksTo?: string,
): Promise<DeleteContainerResult> {
  return transactional(services.adapter, async (repos) => {
    const shelf = await repos.shelves.findById(ownerId, id);
    if (!shelf) throw notFound('Shelf');
    const siblings = await repos.shelves.listByLibrary(ownerId, shelf.libraryId);
    if (siblings.length <= 1) {
      throw new ApiHttpError(409, 'last_shelf', 'A library needs at least one shelf');
    }
    const bookCount = (await repos.books.countByShelf(ownerId, [id])).get(id) ?? 0;
    let movedBooks = 0;
    if (bookCount > 0) {
      if (!moveBooksTo) {
        throw new ApiHttpError(409, 'shelf_not_empty', 'Shelf still holds books', { bookCount });
      }
      await assertTarget(repos, ownerId, moveBooksTo, [id]);
      movedBooks = await repos.books.moveAll(ownerId, [id], moveBooksTo);
    }
    await repos.shelves.delete(ownerId, id);
    return { movedBooks };
  });
}

/**
 * Delete a library and its shelves. Same contract as `deleteShelf`: books need
 * a destination shelf outside the library (409 `library_not_empty`), and the
 * last library cannot be removed (409 `last_library`).
 */
export function deleteLibrary(
  services: Services,
  ownerId: string,
  id: string,
  moveBooksTo?: string,
): Promise<DeleteContainerResult> {
  return transactional(services.adapter, async (repos) => {
    const library = await repos.libraries.findById(ownerId, id);
    if (!library) throw notFound('Library');
    if ((await repos.libraries.listByOwner(ownerId)).length <= 1) {
      throw new ApiHttpError(409, 'last_library', 'You need at least one library');
    }
    const shelfIds = (await repos.shelves.listByLibrary(ownerId, id)).map((s) => s.id);
    const counts = await repos.books.countByShelf(ownerId, shelfIds);
    const bookCount = [...counts.values()].reduce((sum, n) => sum + n, 0);
    let movedBooks = 0;
    if (bookCount > 0) {
      if (!moveBooksTo) {
        throw new ApiHttpError(409, 'library_not_empty', 'Library still holds books', {
          bookCount,
        });
      }
      await assertTarget(repos, ownerId, moveBooksTo, shelfIds);
      movedBooks = await repos.books.moveAll(ownerId, shelfIds, moveBooksTo);
    }
    await repos.libraries.delete(ownerId, id);
    return { movedBooks };
  });
}

/** The destination shelf must exist, belong to the owner and not be one of the shelves going away. */
async function assertTarget(
  repos: Repositories,
  ownerId: string,
  target: string,
  removing: string[],
) {
  if (removing.includes(target) || !(await repos.shelves.findById(ownerId, target))) {
    throw new ApiHttpError(422, 'unknown_shelf', 'Destination shelf not found', {
      shelfId: target,
    });
  }
}

/** Reorder the shelves of a library; the id list must be exactly its shelves. */
export async function reorderShelves(
  services: Services,
  ownerId: string,
  libraryId: string,
  shelfIds: string[],
): Promise<ShelfWithCount[]> {
  await transactional(services.adapter, async (repos) => {
    const current = (await repos.shelves.listByLibrary(ownerId, libraryId)).map((s) => s.id);
    const same =
      current.length === shelfIds.length &&
      new Set(shelfIds).size === shelfIds.length &&
      shelfIds.every((id) => current.includes(id));
    if (!same) {
      throw new ApiHttpError(
        422,
        'shelf_mismatch',
        'shelfIds must list every shelf of the library once',
        {
          expected: current,
        },
      );
    }
    await repos.shelves.reorder(ownerId, shelfIds);
  });
  return listShelves(services.repos, ownerId, libraryId);
}
