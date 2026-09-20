import type { DatabaseAdapter } from '../adapters/types';
import { createAuthIdentityRepository, type AuthIdentityRepository } from './auth-identities';
import { createBookRepository, type BookRepository } from './books';
import { createCatalogBookRepository, type CatalogBookRepository } from './catalog-books';
import { createCoverAssetRepository, type CoverAssetRepository } from './cover-assets';
import { createIsbnCoverRepository, type IsbnCoverRepository } from './isbn-covers';
import { createLendingRepository, type LendingRepository } from './lendings';
import { createLibraryRepository, type LibraryRepository } from './libraries';
import { createLibraryShareRepository, type LibraryShareRepository } from './library-shares';
import { createSessionRepository, type SessionRepository } from './sessions';
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
  /** Stored cover files (shared by ISBN or private to a user). */
  coverAssets: CoverAssetRepository;
  /** ISBN → shared cover resolution cache (hits and misses). */
  isbnCovers: IsbnCoverRepository;
  /** Provider identities (Google `sub`) → user. */
  authIdentities: AuthIdentityRepository;
  /** Server-side sessions behind the `bg_session` cookie. */
  sessions: SessionRepository;
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
    coverAssets: createCoverAssetRepository(kit, tables),
    isbnCovers: createIsbnCoverRepository(kit, tables),
    authIdentities: createAuthIdentityRepository(kit, tables),
    sessions: createSessionRepository(kit, tables),
  };
}

export { NotFoundError } from './base';
export type { CatalogBook, CatalogBookRow } from './catalog-books';
export type { BookRecord, BookRecordPatch, NewBookRecord } from './books';
export type { AuthIdentity, CreateAuthIdentityData } from './auth-identities';
export type { NewCoverAsset } from './cover-assets';
export type { CreateSessionData, Session } from './sessions';
export type { CreateUserData, UserPatch } from './users';
export type { IsbnCover } from './isbn-covers';
export type {
  AuthIdentityRepository,
  BookRepository,
  CatalogBookRepository,
  CoverAssetRepository,
  IsbnCoverRepository,
  LendingRepository,
  LibraryRepository,
  LibraryShareRepository,
  SessionRepository,
  ShelfRepository,
  UserRepository,
};
