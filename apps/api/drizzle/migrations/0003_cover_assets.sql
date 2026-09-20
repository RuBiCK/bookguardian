-- Book covers (BOOK-10).
--
-- Covers are files on disk, never rows: /data/covers/{sha256[0:2]}/{sha256}.webp
-- (+ {sha256}-thumb.webp). The tables below only describe them.
--
--   cover_assets  one row per stored file, keyed by the SHA-256 of the WebP.
--                 owner_id NULL = shared (resolved from a provider by ISBN,
--                 one file for every user that owns the same edition);
--                 owner_id set = private (a user's photo or pasted URL).
--   isbn_covers   ISBN-13 -> shared asset resolution cache, so a second user
--                 adding the same ISBN never asks the providers again. A miss
--                 is a row with a NULL asset and miss_until set.
--   books         gains cover_asset_id (+ cover_override: the user picked
--                 their own) and loses cover_url, which the API now computes.
--
-- Same portability rules as 0001_initial.sql: VARCHAR/TEXT/INTEGER only,
-- ISO-8601 timestamps as VARCHAR(32), no dialect-specific SQL. The FK on
-- books.cover_asset_id is declared inline because SQLite cannot ADD CONSTRAINT
-- (MySQL ignores an inline REFERENCES; the GC never deletes a referenced asset).

CREATE TABLE cover_assets (
  id VARCHAR(64) NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  source VARCHAR(16) NOT NULL,
  owner_id VARCHAR(36) NULL,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_cover_assets_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX idx_cover_assets_owner ON cover_assets (owner_id);
--> statement-breakpoint
CREATE TABLE isbn_covers (
  isbn13 VARCHAR(13) NOT NULL,
  cover_asset_id VARCHAR(64) NULL,
  source VARCHAR(16) NULL,
  fetched_at VARCHAR(32) NOT NULL,
  miss_until VARCHAR(32) NULL,
  PRIMARY KEY (isbn13),
  CONSTRAINT fk_isbn_covers_asset FOREIGN KEY (cover_asset_id) REFERENCES cover_assets (id)
);
--> statement-breakpoint
CREATE INDEX idx_isbn_covers_asset ON isbn_covers (cover_asset_id);
--> statement-breakpoint
ALTER TABLE books ADD COLUMN cover_asset_id VARCHAR(64) NULL REFERENCES cover_assets (id);
--> statement-breakpoint
ALTER TABLE books ADD COLUMN cover_override INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX idx_books_cover_asset ON books (cover_asset_id);
--> statement-breakpoint
ALTER TABLE books DROP COLUMN cover_url;
