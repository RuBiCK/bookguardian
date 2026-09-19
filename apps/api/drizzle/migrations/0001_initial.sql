-- Bookguardian initial schema.
--
-- This file is executed verbatim by apps/api/src/db/migrate.ts through the
-- active Drizzle adapter (SQLite, Postgres or MySQL). It therefore only uses
-- SQL that all three engines accept:
--   * VARCHAR(n) / TEXT / INTEGER column types
--   * ISO-8601 timestamps stored as VARCHAR(32)
--   * JSON arrays stored as TEXT
--   * table-level FOREIGN KEY constraints (MySQL ignores inline REFERENCES)
--   * no CREATE INDEX IF NOT EXISTS (MySQL 8 does not support it)
-- Statements are separated by the drizzle-style breakpoint marker below.

CREATE TABLE users (
  id VARCHAR(36) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id)
);
--> statement-breakpoint
CREATE TABLE libraries (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  location VARCHAR(200) NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_libraries_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX idx_libraries_owner ON libraries (owner_id);
--> statement-breakpoint
CREATE TABLE shelves (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  library_id VARCHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_shelves_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_shelves_library FOREIGN KEY (library_id) REFERENCES libraries (id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX idx_shelves_library ON shelves (library_id, sort_order);
--> statement-breakpoint
CREATE TABLE books (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  shelf_id VARCHAR(36) NOT NULL,
  isbn10 VARCHAR(10) NULL,
  isbn13 VARCHAR(13) NULL,
  title VARCHAR(500) NOT NULL,
  subtitle VARCHAR(500) NULL,
  authors TEXT NOT NULL,
  publisher VARCHAR(200) NULL,
  published_date VARCHAR(40) NULL,
  pages INTEGER NULL,
  language VARCHAR(16) NULL,
  cover_url VARCHAR(2048) NULL,
  categories TEXT NOT NULL,
  description TEXT NULL,
  notes TEXT NULL,
  rating INTEGER NULL,
  read_status VARCHAR(16) NOT NULL DEFAULT 'to_read',
  read_at VARCHAR(10) NULL,
  added_at VARCHAR(32) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_books_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_books_shelf FOREIGN KEY (shelf_id) REFERENCES shelves (id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX idx_books_owner ON books (owner_id);
--> statement-breakpoint
CREATE INDEX idx_books_shelf ON books (shelf_id);
--> statement-breakpoint
CREATE INDEX idx_books_isbn13 ON books (isbn13);
--> statement-breakpoint
CREATE TABLE lendings (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  borrower_name VARCHAR(200) NOT NULL,
  borrower_contact VARCHAR(300) NULL,
  lent_at VARCHAR(32) NOT NULL,
  due_at VARCHAR(10) NULL,
  returned_at VARCHAR(32) NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_lendings_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_lendings_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX idx_lendings_book ON lendings (book_id);
--> statement-breakpoint
CREATE INDEX idx_lendings_open ON lendings (owner_id, returned_at);
--> statement-breakpoint
CREATE TABLE library_shares (
  id VARCHAR(36) NOT NULL,
  library_id VARCHAR(36) NOT NULL,
  grantee_id VARCHAR(36) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'viewer',
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_library_shares_grantee UNIQUE (library_id, grantee_id),
  CONSTRAINT fk_library_shares_library FOREIGN KEY (library_id) REFERENCES libraries (id) ON DELETE CASCADE,
  CONSTRAINT fk_library_shares_grantee FOREIGN KEY (grantee_id) REFERENCES users (id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX idx_library_shares_grantee ON library_shares (grantee_id);
