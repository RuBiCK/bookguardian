/**
 * Drizzle table definitions for the SQLite dialect.
 *
 * The logical schema (table names, column names, nullability) is identical to
 * `postgres.ts` and `mysql.ts`; `test/schema-parity.test.ts` enforces that. The
 * DDL itself lives in `drizzle/migrations/*.sql` and is shared by all dialects.
 */
import {
  customType,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/** JSON array stored in a TEXT column (portable across dialects). */
const jsonStringArray = customType<{ data: string[]; driverData: string }>({
  dataType: () => 'text',
  toDriver: (value) => JSON.stringify(value),
  fromDriver: (value) => JSON.parse(value) as string[],
});

const id = () => text('id').notNull().primaryKey();
const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};

export const schemaMigrations = sqliteTable('schema_migrations', {
  name: text('name').notNull().primaryKey(),
  appliedAt: text('applied_at').notNull(),
});

export const users = sqliteTable('users', {
  id: id(),
  displayName: text('display_name').notNull(),
  email: text('email'),
  ...timestamps,
});

export const libraries = sqliteTable(
  'libraries',
  {
    id: id(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    location: text('location'),
    ...timestamps,
  },
  (t) => [index('idx_libraries_owner').on(t.ownerId)],
);

export const shelves = sqliteTable(
  'shelves',
  {
    id: id(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    libraryId: text('library_id')
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('idx_shelves_library').on(t.libraryId, t.sortOrder)],
);

export const books = sqliteTable(
  'books',
  {
    id: id(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shelfId: text('shelf_id')
      .notNull()
      .references(() => shelves.id, { onDelete: 'cascade' }),
    isbn10: text('isbn10'),
    isbn13: text('isbn13'),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    authors: jsonStringArray('authors').notNull(),
    publisher: text('publisher'),
    publishedDate: text('published_date'),
    pages: integer('pages'),
    language: text('language'),
    coverUrl: text('cover_url'),
    categories: jsonStringArray('categories').notNull(),
    description: text('description'),
    notes: text('notes'),
    rating: integer('rating'),
    readStatus: text('read_status').notNull().default('to_read'),
    startedAt: text('started_at'),
    readAt: text('read_at'),
    addedAt: text('added_at').notNull(),
    ...timestamps,
  },
  (t) => [
    index('idx_books_owner').on(t.ownerId),
    index('idx_books_shelf').on(t.shelfId),
    index('idx_books_isbn13').on(t.isbn13),
  ],
);

export const lendings = sqliteTable(
  'lendings',
  {
    id: id(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: text('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    borrowerName: text('borrower_name').notNull(),
    borrowerContact: text('borrower_contact'),
    lentAt: text('lent_at').notNull(),
    dueAt: text('due_at'),
    returnedAt: text('returned_at'),
    ...timestamps,
  },
  (t) => [
    index('idx_lendings_book').on(t.bookId),
    index('idx_lendings_open').on(t.ownerId, t.returnedAt),
  ],
);

export const libraryShares = sqliteTable(
  'library_shares',
  {
    id: id(),
    libraryId: text('library_id')
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' }),
    granteeId: text('grantee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('viewer'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('uq_library_shares_grantee').on(t.libraryId, t.granteeId),
    index('idx_library_shares_grantee').on(t.granteeId),
  ],
);

export const sqliteSchema = {
  schemaMigrations,
  users,
  libraries,
  shelves,
  books,
  lendings,
  libraryShares,
};
