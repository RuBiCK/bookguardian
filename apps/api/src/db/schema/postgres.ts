/**
 * Drizzle table definitions for the Postgres dialect.
 *
 * Mirrors `sqlite.ts` column for column; see that file for the rationale.
 */
import {
  customType,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

const jsonStringArray = customType<{ data: string[]; driverData: string }>({
  dataType: () => 'text',
  toDriver: (value) => JSON.stringify(value),
  fromDriver: (value) => JSON.parse(value) as string[],
});

/** JSON object of provider identifiers stored in a TEXT column. */
const jsonStringRecord = customType<{ data: Record<string, string>; driverData: string }>({
  dataType: () => 'text',
  toDriver: (value) => JSON.stringify(value),
  fromDriver: (value) => JSON.parse(value) as Record<string, string>,
});

/** Boolean stored as INTEGER 0/1 (portable; MySQL has no real boolean either). */
const intBoolean = customType<{ data: boolean; driverData: number }>({
  dataType: () => 'integer',
  toDriver: (value) => (value ? 1 : 0),
  fromDriver: (value) => Number(value) === 1,
});

const id = () => varchar('id', { length: 36 }).notNull().primaryKey();
const ts = (name: string) => varchar(name, { length: 32 });
const timestamps = {
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
};

export const schemaMigrations = pgTable('schema_migrations', {
  name: varchar('name', { length: 255 }).notNull().primaryKey(),
  appliedAt: ts('applied_at').notNull(),
});

export const users = pgTable('users', {
  id: id(),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  email: varchar('email', { length: 254 }),
  emailVerified: intBoolean('email_verified').notNull().default(false),
  avatarUrl: varchar('avatar_url', { length: 2048 }),
  lastLoginAt: ts('last_login_at'),
  ...timestamps,
});

export const libraries = pgTable(
  'libraries',
  {
    id: id(),
    ownerId: varchar('owner_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    location: varchar('location', { length: 200 }),
    ...timestamps,
  },
  (t) => [index('idx_libraries_owner').on(t.ownerId)],
);

export const shelves = pgTable(
  'shelves',
  {
    id: id(),
    ownerId: varchar('owner_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    libraryId: varchar('library_id', { length: 36 })
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('idx_shelves_library').on(t.libraryId, t.sortOrder)],
);

export const books = pgTable(
  'books',
  {
    id: id(),
    ownerId: varchar('owner_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shelfId: varchar('shelf_id', { length: 36 })
      .notNull()
      .references(() => shelves.id, { onDelete: 'cascade' }),
    isbn10: varchar('isbn10', { length: 10 }),
    isbn13: varchar('isbn13', { length: 13 }),
    title: varchar('title', { length: 500 }).notNull(),
    subtitle: varchar('subtitle', { length: 500 }),
    authors: jsonStringArray('authors').notNull(),
    publisher: varchar('publisher', { length: 200 }),
    publishedDate: varchar('published_date', { length: 40 }),
    pages: integer('pages'),
    language: varchar('language', { length: 16 }),
    coverAssetId: varchar('cover_asset_id', { length: 64 }).references(() => coverAssets.id),
    coverOverride: intBoolean('cover_override').notNull().default(false),
    categories: jsonStringArray('categories').notNull(),
    description: text('description'),
    notes: text('notes'),
    rating: integer('rating'),
    readStatus: varchar('read_status', { length: 16 }).notNull().default('to_read'),
    readAt: varchar('read_at', { length: 10 }),
    addedAt: ts('added_at').notNull(),
    ...timestamps,
  },
  (t) => [
    index('idx_books_owner').on(t.ownerId),
    index('idx_books_shelf').on(t.shelfId),
    index('idx_books_isbn13').on(t.isbn13),
    index('idx_books_cover_asset').on(t.coverAssetId),
  ],
);

export const lendings = pgTable(
  'lendings',
  {
    id: id(),
    ownerId: varchar('owner_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: varchar('book_id', { length: 36 })
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    borrowerName: varchar('borrower_name', { length: 200 }).notNull(),
    borrowerContact: varchar('borrower_contact', { length: 300 }),
    lentAt: ts('lent_at').notNull(),
    dueAt: varchar('due_at', { length: 10 }),
    returnedAt: ts('returned_at'),
    ...timestamps,
  },
  (t) => [
    index('idx_lendings_book').on(t.bookId),
    index('idx_lendings_open').on(t.ownerId, t.returnedAt),
  ],
);

export const libraryShares = pgTable(
  'library_shares',
  {
    id: id(),
    libraryId: varchar('library_id', { length: 36 })
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' }),
    granteeId: varchar('grantee_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull().default('viewer'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('uq_library_shares_grantee').on(t.libraryId, t.granteeId),
    index('idx_library_shares_grantee').on(t.granteeId),
  ],
);

export const catalogBooks = pgTable('catalog_books', {
  isbn13: varchar('isbn13', { length: 13 }).notNull().primaryKey(),
  isbn10: varchar('isbn10', { length: 10 }),
  title: varchar('title', { length: 500 }),
  subtitle: varchar('subtitle', { length: 500 }),
  authors: jsonStringArray('authors').notNull(),
  publisher: varchar('publisher', { length: 200 }),
  publishedDate: varchar('published_date', { length: 40 }),
  pages: integer('pages'),
  language: varchar('language', { length: 16 }),
  coverUrl: varchar('cover_url', { length: 2048 }),
  categories: jsonStringArray('categories').notNull(),
  description: text('description'),
  source: varchar('source', { length: 32 }),
  providerIds: jsonStringRecord('provider_ids').notNull(),
  raw: text('raw'),
  fetchedAt: ts('fetched_at').notNull(),
  refreshedAt: ts('refreshed_at').notNull(),
  missUntil: ts('miss_until'),
});

export const coverAssets = pgTable(
  'cover_assets',
  {
    id: varchar('id', { length: 64 }).notNull().primaryKey(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytes: integer('bytes').notNull(),
    source: varchar('source', { length: 16 }).notNull(),
    ownerId: varchar('owner_id', { length: 36 }).references(() => users.id, {
      onDelete: 'cascade',
    }),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('idx_cover_assets_owner').on(t.ownerId)],
);

export const isbnCovers = pgTable(
  'isbn_covers',
  {
    isbn13: varchar('isbn13', { length: 13 }).notNull().primaryKey(),
    coverAssetId: varchar('cover_asset_id', { length: 64 }).references(() => coverAssets.id),
    source: varchar('source', { length: 16 }),
    fetchedAt: ts('fetched_at').notNull(),
    missUntil: ts('miss_until'),
  },
  (t) => [index('idx_isbn_covers_asset').on(t.coverAssetId)],
);

/**
 * A provider identity (`google` + the `sub` claim) and the user it maps to.
 * See `0004_auth.sql` and ADR 0005: one account per email, a user may hold
 * several identities, an identity belongs to exactly one user.
 */
export const authIdentities = pgTable(
  'auth_identities',
  {
    id: id(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    providerSubject: varchar('provider_subject', { length: 255 }).notNull(),
    emailAtLink: varchar('email_at_link', { length: 254 }),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('uq_auth_identities_subject').on(t.provider, t.providerSubject),
    index('idx_auth_identities_user').on(t.userId),
  ],
);

/** Server-side sessions; only the SHA-256 of the cookie token is stored. */
export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    createdAt: ts('created_at').notNull(),
    expiresAt: ts('expires_at').notNull(),
    lastSeenAt: ts('last_seen_at').notNull(),
    userAgent: varchar('user_agent', { length: 512 }),
  },
  (t) => [
    uniqueIndex('uq_sessions_token_hash').on(t.tokenHash),
    index('idx_sessions_user').on(t.userId),
  ],
);

export const postgresSchema = {
  schemaMigrations,
  users,
  libraries,
  shelves,
  books,
  lendings,
  libraryShares,
  catalogBooks,
  coverAssets,
  isbnCovers,
  authIdentities,
  sessions,
};
