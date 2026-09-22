# ADR 0004 — Covers are content-addressed WebP files, shared by ISBN

- Status: accepted
- Date: 2026-09-20

## Context

Until BOOK-10 a book only had a cover when it came through the scanner or
someone pasted a URL: `books.cover_url` pointed at Open Library or Google, the
grid stayed mostly empty, and every cover depended on an external host being
up and not rate limiting us. Two product constraints frame the fix:

1. **No images in the database.** Covers are files; SQLite (and later
   Postgres/MySQL) holds metadata only — no BLOBs, no base64, not even in
   test fixtures.
2. **One file per edition, not per book.** A thousand users owning the same
   ISBN must share one cover on disk. The default cover of an ISBN is a
   shared resource, not something a user's book owns. A user's own photo, on
   the other hand, is theirs alone.

## Decision

- **Content-addressed store.** Every image (provider download, user photo,
  pasted URL) is normalised the same way: EXIF-rotated, resized to at most
  600 px tall (original ratio, never enlarged), encoded as WebP at quality ~80,
  plus a 200 px thumbnail. The asset id is the SHA-256 of the full-size WebP
  and doubles as the file name: `COVERS_DIR/<sha[0:2]>/<sha>.webp` and
  `<sha>-thumb.webp`. Identical bytes therefore land in one file, the
  two-character prefix keeps directories small, and the URL changes whenever
  the image does, so clients may cache `/api/covers/<sha>.webp` for a year
  (`immutable`, ETag = hash) with no invalidation to manage.
- **Two kinds of asset.** `cover_assets.owner_id` is NULL for a cover resolved
  from a provider by ISBN — shared, public — and set for a photo or pasted
  URL — private, served only to its owner or to a grantee of a library that
  holds a book showing it (`library_shares`), 404 for anyone else. Identical
  bytes brought by two different users (or by a user and a provider) collapse
  into one _shared_ row: a cover image is not a secret, and a private row
  would 404 for the second reader.
- **ISBN resolution cache.** `isbn_covers(isbn13 → cover_asset_id)` makes the
  second user of an edition link the existing file without any provider call;
  a confirmed miss (every provider answered, none had an image) is cached
  there for `COVERS_MISS_DAYS` so unknown ISBNs do not hammer the providers.
  Transient failures are never cached.
- **Books point, never copy.** `books.cover_asset_id` references the asset a
  book shows and `books.cover_override` records that the user chose it
  (photo / URL), which stops the cascade from replacing it. `cover_url` is
  gone from the table; the DTO computes it from the asset id.
- **Async by design.** Creating or editing a book never waits for a download.
  An in-process queue runs one job at a time, spaces provider traffic
  (`COVERS_MIN_INTERVAL_MS`, Open Library asks for ≤ 1 req/s), retries
  transient failures with exponential backoff, and exposes `coverPending` on
  the DTO so the web app polls until the cover lands. The same queue serves the
  Settings backfill and the boot-time backfill.
- **Garbage collection instead of deletes.** Removing a book never touches a
  file (it may be shared). A GC at boot and daily deletes private assets no
  book references and shared assets neither a book nor `isbn_covers`
  references once they are older than `COVERS_GC_DAYS`.

- **A pasted cover URL is an untrusted destination** (added for BOOK-20). The
  server fetches whatever `coverUrl` names, so the address policy in
  `packages/shared/src/lib/ip.ts` is applied twice: the input schema rejects
  every scheme but `http`/`https` and every literal address outside the public
  internet, and `covers/guard.ts` re-applies it at download time to what the
  hostname _resolves_ to and to every redirect target (redirects are walked in
  `downloadImage` rather than followed by `fetch`). A deny-list, not an
  allow-list of the two providers, because pasting an arbitrary cover URL is a
  real flow in the add-book form. The origins an operator configured are
  exempt — where a self-hosted mirror lives is a deployment decision — and
  that exemption is wired only into the cascade's guard, never the pasted-URL
  one. A blocked URL is a `BlockedUrlError`, deliberately not a
  `TransientError`: retrying cannot make an address allowed, and four attempts
  with backoff would hand the caller a timing oracle. Residual risk: `fetch`
  resolves the name again on its own, so DNS rebinding is not closed by this;
  doing that needs the checked address pinned into the connection.

## Consequences

- `sharp` becomes an API dependency (prebuilt binaries, no install script;
  the Docker image gets the linux build through pnpm's optional dependencies).
- The covers directory is part of the persistent state next to the SQLite
  file: back up `/data` as a whole. Losing the directory is recoverable — the
  backfill re-fetches shared covers — except for private photos.
- The migration drops `books.cover_url`. Provider URLs are re-resolved by ISBN
  at boot; a hand-pasted URL on a book without an ISBN has to be re-added
  (paste it again or upload a photo).
- Multi-user arrives without a schema change: ownership and sharing are
  already expressed on `cover_assets`, and the served-cover check already
  consults `library_shares`.
- A cover that Open Library later replaces stays as it was until the ISBN is
  re-resolved (a miss expiring, or a user dropping their own cover); there is
  no periodic refresh of shared covers. Add one if stale covers turn out to
  matter.
