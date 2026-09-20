# ADR 0003 — Shared ISBN catalogue in the DB instead of a per-process cache

- Status: accepted
- Date: 2026-09-19

## Context

`GET /api/lookup/isbn/:isbn` (BOOK-3) resolves an ISBN through Open Library
and, failing that, Google Books, and cached the answer per ISBN **in memory
with a TTL**. That cache is lost on every restart, is private to one process,
and expires daily, so a book scanned by N people — or by one person after a
deploy — costs N provider round-trips. Both providers rate-limit (Google's
anonymous quota is tiny) and a phone on a shelf-scanning spree can burn
through a limit in minutes. Upcoming features (covers in BOOK-10, statistics,
sharing) all want the same provider metadata again.

## Decision

### 1. Provider metadata is persisted in a shared, owner-less table

`catalog_books` holds one row per ISBN-13 with the fields of the shared
`BookDraft`, provenance (`source`, `provider_ids`, `raw`) and freshness
(`fetched_at`, `refreshed_at`, `miss_until`). It has **no `owner_id`**: it is
what the providers said about a number, not something a user owns, and every
user of the instance reads the same row. It lives in the same database as the
user data, through the same portable migration runner and `DialectKit`
repository layer as everything else (ADR 0002), so it needs no extra
infrastructure and comes along wherever the SQLite file goes.

### 2. The lookup service is DB-first

`apps/api/src/lookup/service.ts` consults the catalogue before any provider:

- fresh hit → served, zero provider calls;
- miss with `miss_until` in the future → 404 immediately (negative cache,
  `CATALOG_MISS_DAYS`, default 7 — new books do appear later, so it expires);
- otherwise Open Library → Google Books, the answer (hit or miss) is stored,
  and concurrent requests for the same ISBN share one call (single-flight);
- a hit older than `CATALOG_REFRESH_DAYS` (default 180) is served as is and
  refreshed in the background (stale-while-revalidate); a failed refresh leaves
  the row untouched, a refresh that finds nothing keeps the metadata and only
  bumps `refreshed_at`.

Free-text search results are volatile and stay in a small in-memory TTL
cache, but each result that carries an ISBN-13 is upserted opportunistically
(never overwriting a fuller record), so tapping a search candidate does not
trigger a second fetch. The in-memory ISBN cache is gone: a local SQLite read
is as fast as it was and the database is the single source of truth.

### 3. Books remain per-user copies

`books` keeps its own metadata columns. The catalogue pre-fills the add form;
the user may then edit anything. There is no foreign key from `books` to
`catalog_books` and edits are not synced back. BOOK-10 will key `isbn_covers`
on the same `isbn13` and can hang `cover_asset_id` off this table.

## Consequences

- A repeated ISBN lookup costs one provider round-trip per instance lifetime
  (plus one refresh every `CATALOG_REFRESH_DAYS`), regardless of restarts,
  processes or number of users. Rate limits stop being a function of how many
  phones are scanning.
- Metadata can drift from the providers for up to `CATALOG_REFRESH_DAYS`;
  the stored `raw` payload allows re-normalising without re-fetching if the
  mapping changes.
- Resetting the catalogue is a `DELETE FROM catalog_books` (documented in the
  README); nothing else references it.
- The table is shared across users by design. When multi-user arrives, the
  catalogue must remain read-only for end users (writes only come from the
  lookup service) so one user cannot poison what another sees.
