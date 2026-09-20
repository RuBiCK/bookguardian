/**
 * Drizzle table definitions for the MySQL dialect.
 *
 * Mirrors `sqlite.ts` column for column; see that file for the rationale.
 */
import {
  customType,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

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

const id = () => varchar('id', { length: 36 }).notNull().primaryKey();
const ts = (name: string) => varchar(name, { length: 32 });
const timestamps = {
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
};

export const schemaMigrations = mysqlTable('schema_migrations', {
  name: varchar('name', { length: 255 }).notNull().primaryKey(),
  appliedAt: ts('applied_at').notNull(),
});

export const users = mysqlTable('users', {
  id: id(),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  email: varchar('email', { length: 254 }),
  ...timestamps,
});

export const libraries = mysqlTable(
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

export const shelves = mysqlTable(
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
    sortOrder: int('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('idx_shelves_library').on(t.libraryId, t.sortOrder)],
);

export const books = mysqlTable(
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
    pages: int('pages'),
    language: varchar('language', { length: 16 }),
    coverUrl: varchar('cover_url', { length: 2048 }),
    categories: jsonStringArray('categories').notNull(),
    description: text('description'),
    notes: text('notes'),
    rating: int('rating'),
    readStatus: varchar('read_status', { length: 16 }).notNull().default('to_read'),
    readAt: varchar('read_at', { length: 10 }),
    addedAt: ts('added_at').notNull(),
    ...timestamps,
  },
  (t) => [
    index('idx_books_owner').on(t.ownerId),
    index('idx_books_shelf').on(t.shelfId),
    index('idx_books_isbn13').on(t.isbn13),
  ],
);

export const lendings = mysqlTable(
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

export const libraryShares = mysqlTable(
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

export const catalogBooks = mysqlTable('catalog_books', {
  isbn13: varchar('isbn13', { length: 13 }).notNull().primaryKey(),
  isbn10: varchar('isbn10', { length: 10 }),
  title: varchar('title', { length: 500 }),
  subtitle: varchar('subtitle', { length: 500 }),
  authors: jsonStringArray('authors').notNull(),
  publisher: varchar('publisher', { length: 200 }),
  publishedDate: varchar('published_date', { length: 40 }),
  pages: int('pages'),
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

export const mysqlSchema = {
  schemaMigrations,
  users,
  libraries,
  shelves,
  books,
  lendings,
  libraryShares,
  catalogBooks,
};
