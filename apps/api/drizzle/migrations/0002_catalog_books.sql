-- Shared ISBN catalogue (BOOK-11).
--
-- One row per ISBN-13 holding the metadata a provider returned for it, so an
-- ISBN is looked up online at most once per instance. Provider data, not user
-- data: there is no owner_id and every user reads the same row. A miss (no
-- provider knows the ISBN) is a row with a NULL title and miss_until set.
-- Same portability rules as 0001_initial.sql: VARCHAR/TEXT/INTEGER only,
-- ISO-8601 timestamps as VARCHAR(32), JSON as TEXT, no dialect-specific SQL.
-- BOOK-10 (cover assets) keys isbn_covers on the same isbn13.

CREATE TABLE catalog_books (
  isbn13 VARCHAR(13) NOT NULL,
  isbn10 VARCHAR(10) NULL,
  title VARCHAR(500) NULL,
  subtitle VARCHAR(500) NULL,
  authors TEXT NOT NULL,
  publisher VARCHAR(200) NULL,
  published_date VARCHAR(40) NULL,
  pages INTEGER NULL,
  language VARCHAR(16) NULL,
  cover_url VARCHAR(2048) NULL,
  categories TEXT NOT NULL,
  description TEXT NULL,
  source VARCHAR(32) NULL,
  provider_ids TEXT NOT NULL,
  raw TEXT NULL,
  fetched_at VARCHAR(32) NOT NULL,
  refreshed_at VARCHAR(32) NOT NULL,
  miss_until VARCHAR(32) NULL,
  PRIMARY KEY (isbn13)
);
