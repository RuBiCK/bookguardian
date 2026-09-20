import type { DatabaseAdapter } from '../adapters/types';
import { createBookRepository, type BookRepository } from './books';
import { createCatalogBookRepository, type CatalogBookRepository } from './catalog-books';
import { createLendingRepository, type LendingRepository } from './lendings';
import { createLibraryRepository, type LibraryRepository } from './libraries';
import { createLibraryShareRepository, type LibraryShareRepository } from './library-shares';
import { createShelfRepository, type ShelfRepository } from './shelves';
import { createUserRepository, type UserRepository } from './users';

export interface Repositories {
  users: UserRepository;
  libraries: LibraryRepository;
  shelves: ShelfRepository;
  books: BookRepository;
  lendings: LendingRepository;
  libraryShares: LibraryShareRepository;
  /** Shared, owner-less ISBN → provider metadata cache. */
  catalogBooks: CatalogBookRepository;
}

/** Repositories are dialect-agnostic: they only see the adapter's kit + tables. */
export function createRepositories(adapter: DatabaseAdapter): Repositories {
  const { kit, tables } = adapter;
  return {
    users: createUserRepository(kit, tables),
    libraries: createLibraryRepository(kit, tables),
    shelves: createShelfRepository(kit, tables),
    books: createBookRepository(kit, tables),
    lendings: createLendingRepository(kit, tables),
    libraryShares: createLibraryShareRepository(kit, tables),
    catalogBooks: createCatalogBookRepository(kit, tables),
  };
}

export { NotFoundError } from './base';
export type { CatalogBook, CatalogBookRow } from './catalog-books';
export type {
  BookRepository,
  CatalogBookRepository,
  LendingRepository,
  LibraryRepository,
  LibraryShareRepository,
  ShelfRepository,
  UserRepository,
};
