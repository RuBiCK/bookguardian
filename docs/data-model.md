# Data model

Canonical names come from the project brief: **Library → Shelf → Book**, plus
**Lending** and **LibraryShare**. Every aggregate carries `owner_id`; sharing is
modelled from the first migration so multi-user arrives without a schema
rewrite. The owner-less tables are **CatalogBook** — provider metadata per
ISBN-13, shared by every user ([ADR 0003](adr/0003-shared-isbn-catalogue.md)) —
and **IsbnCover**, which maps an ISBN-13 to the shared **CoverAsset** every
book with that ISBN shows ([ADR 0004](adr/0004-cover-assets.md)). Cover images
themselves are files on disk; the tables only describe them.

Accounts ([ADR 0005](adr/0005-authentication.md)): a **User** is one person,
identified by a unique, lower-cased email; **AuthIdentity** rows map a
provider's stable id (Google's `sub`) to that user, and **Session** rows back
the `bg_session` cookie (only the SHA-256 of the token is stored).

```mermaid
erDiagram
    USERS ||--o{ AUTH_IDENTITIES : "signs in as"
    USERS ||--o{ SESSIONS : "is signed in via"
    USERS ||--o{ LIBRARIES : owns
    USERS ||--o{ SHELVES : owns
    USERS ||--o{ BOOKS : owns
    USERS ||--o{ LENDINGS : owns
    USERS ||--o{ LIBRARY_SHARES : "is grantee of"
    LIBRARIES ||--o{ SHELVES : contains
    LIBRARIES ||--o{ LIBRARY_SHARES : "shared via"
    SHELVES ||--o{ BOOKS : holds
    BOOKS ||--o{ LENDINGS : "lent as"
    COVER_ASSETS ||--o{ BOOKS : "shown by"
    COVER_ASSETS ||--o{ ISBN_COVERS : "resolved for"
    USERS ||--o{ COVER_ASSETS : "owns (private only)"

    USERS {
        varchar(36) id PK
        varchar(120) display_name
        varchar(254) email "unique, lower-case; NULL only for an unclaimed pre-accounts local user"
        int email_verified "0/1"
        varchar(2048) avatar_url "nullable"
        varchar(32) last_login_at "nullable"
        varchar(32) created_at "ISO-8601"
        varchar(32) updated_at "ISO-8601"
    }
    AUTH_IDENTITIES {
        varchar(36) id PK
        varchar(36) user_id FK
        varchar(32) provider "google | test"
        varchar(255) provider_subject "unique with provider"
        varchar(254) email_at_link "nullable"
        varchar(32) created_at
    }
    SESSIONS {
        varchar(36) id PK
        varchar(36) user_id FK "indexed"
        varchar(64) token_hash "unique, SHA-256 of the cookie token"
        varchar(32) created_at
        varchar(32) expires_at "sliding"
        varchar(32) last_seen_at
        varchar(512) user_agent "nullable"
    }
    LIBRARIES {
        varchar(36) id PK
        varchar(36) owner_id FK
        varchar(120) name
        varchar(200) location "nullable"
        varchar(32) created_at
        varchar(32) updated_at
    }
    SHELVES {
        varchar(36) id PK
        varchar(36) owner_id FK
        varchar(36) library_id FK
        varchar(120) name
        int sort_order
        varchar(32) created_at
        varchar(32) updated_at
    }
    BOOKS {
        varchar(36) id PK
        varchar(36) owner_id FK
        varchar(36) shelf_id FK
        varchar(10) isbn10 "nullable"
        varchar(13) isbn13 "nullable, indexed"
        varchar(500) title
        varchar(500) subtitle "nullable"
        text authors "JSON string[]"
        varchar(200) publisher "nullable"
        varchar(40) published_date "nullable, free-form"
        int pages "nullable"
        varchar(16) language "nullable, BCP-47"
        varchar(64) cover_asset_id "nullable FK, indexed"
        int cover_override "0 = shared ISBN cover, 1 = user's own"
        text categories "JSON string[]"
        text description "nullable"
        text notes "nullable"
        int rating "nullable, 0-5"
        varchar(16) read_status "to_read | reading | read"
        varchar(10) read_at "nullable, YYYY-MM-DD"
        varchar(32) added_at
        varchar(32) created_at
        varchar(32) updated_at
    }
    LENDINGS {
        varchar(36) id PK
        varchar(36) owner_id FK
        varchar(36) book_id FK
        varchar(200) borrower_name
        varchar(300) borrower_contact "nullable"
        varchar(32) lent_at
        varchar(10) due_at "nullable, YYYY-MM-DD"
        varchar(32) returned_at "nullable"
        varchar(32) created_at
        varchar(32) updated_at
    }
    LIBRARY_SHARES {
        varchar(36) id PK
        varchar(36) library_id FK
        varchar(36) grantee_id FK
        varchar(16) role "viewer"
        varchar(32) created_at
        varchar(32) updated_at
    }
    CATALOG_BOOKS {
        varchar(13) isbn13 PK "no owner: shared provider data"
        varchar(10) isbn10 "nullable, derived (979 has none)"
        varchar(500) title "nullable: NULL = miss"
        varchar(500) subtitle "nullable"
        text authors "JSON string[]"
        varchar(200) publisher "nullable"
        varchar(40) published_date "nullable"
        int pages "nullable"
        varchar(16) language "nullable"
        varchar(2048) cover_url "nullable, provider URL"
        text categories "JSON string[]"
        text description "nullable"
        varchar(32) source "open_library | google_books, nullable"
        text provider_ids "JSON {source: id}"
        text raw "JSON BookDraft, nullable"
        varchar(32) fetched_at
        varchar(32) refreshed_at
        varchar(32) miss_until "nullable: negative cache"
    }
    COVER_ASSETS {
        varchar(64) id PK "sha256 of the WebP = file name"
        int width
        int height
        int bytes
        varchar(16) source "open_library | google_books | user_photo | manual"
        varchar(36) owner_id "nullable FK: NULL = shared, set = private"
        varchar(32) created_at
    }
    ISBN_COVERS {
        varchar(13) isbn13 PK "no owner: shared resolution cache"
        varchar(64) cover_asset_id "nullable FK: NULL = miss"
        varchar(16) source "nullable"
        varchar(32) fetched_at
        varchar(32) miss_until "nullable: retry after"
    }
```

## Notes

- **Accounts.** A user is one person and one email (`users.email`,
  lower-cased, unique). `auth_identities` holds the provider ids that map to
  that user — a Google `sub` today, other providers later without a schema
  change — and signing in with a new identity whose verified email already
  belongs to a user links to that user instead of creating another. `email`
  is `NULL` only on the local user of a database seeded before accounts,
  until the first sign-in claims it. `sessions` stores the SHA-256 of the
  cookie token, never the token; rows expire (sliding) and are purged daily.
- **Ownership.** `owner_id` on libraries, shelves, books and lendings is
  denormalised on purpose: every repository query filters by owner without a
  join — reads by id included — so a foreign id is indistinguishable from a
  missing one (`404`, never `403`). Every new account is provisioned with a
  "My Library" library and a "Default" shelf in the transaction that creates
  it (`apps/api/src/provisioning.ts`). See "Isolation between users" in
  [auth.md](auth.md).
- **Shared by design (no `owner_id`).** `catalog_books` (ISBN metadata),
  `isbn_covers` and the shared rows of `cover_assets` (`owner_id` NULL) are
  common to every user: an ISBN's description or cover is not anyone's data.
  `/api/lookup/*` reads and fills that catalogue for whoever is signed in.
- **Sharing.** `library_shares(library_id, grantee_id)` is unique; `role` is
  `viewer` only for now. Read-only sharing means a grantee can list a library's
  shelves and books but never write. No route writes the table yet; the only
  code that reads it is the private-cover check, so today it grants nothing.
- **Account deletion.** `DELETE /api/auth/me` removes the `users` row; the
  foreign keys cascade to sessions, identities, libraries, shelves, books,
  lendings, library shares and the user's private `cover_assets` (whose files
  the API removes right away, since the GC can no longer see the rows). Shared
  covers and the catalogue stay.
- **Reading state.** `read_status` is one of `to_read`, `reading`, `read`;
  `read_at` is a local calendar day (`YYYY-MM-DD`, no time, no UTC shift) and
  is only ever set when the status is `read`: marking a book read without a
  date stamps today, an existing date survives re-marking, and any other
  status clears it (`resolveReadAt` in `packages/shared`). Future dates are
  rejected by the shared `readAtSchema`, on the API and in the web form alike.
  `rating` is 1–5 (`NULL` = unrated; the API maps `0` to `NULL`, see
  `normaliseRating`).
- **Re-reads are not modelled yet.** A book carries a single finished date.
  When re-reading matters, add a `book_reads (id, book_id, read_at)` history
  table and keep `books.read_at` as the latest one — no rewrite of the
  existing column is needed.
- **Lending.** A lending is open while `returned_at` is `NULL`; the
  `(owner_id, returned_at)` index serves the "what's lent out" list. A book
  has at most one open lending at a time — enforced by the API inside a
  transaction (`apps/api/src/lending.ts`), not by a constraint, so the rule
  stays portable. `due_at` is a calendar day; "overdue" is derived (open and
  `due_at` before today), never stored.
- **Deletes cascade** down the hierarchy (user → library → shelf → book →
  lending) so removing a library never leaves orphans.
- **Catalogue.** `catalog_books` is filled lazily by `/api/lookup/isbn/:isbn`
  and search results; `books` copies its fields at add time and never
  references it, so a user's edits are theirs alone.
- **Covers.** A cover is a WebP file under `COVERS_DIR/<xx>/<sha256>.webp`
  (+ `-thumb`), never a blob. `cover_assets` names the file by its content
  hash, so identical images are stored once; `owner_id` NULL means "resolved
  from a provider by ISBN, shared by everyone", a user id means "this user's
  photo or pasted URL, served only to them (or a library-share grantee)".
  `isbn_covers` caches ISBN → shared asset (a row with a NULL asset and
  `miss_until` is a cached miss). `books.cover_asset_id` points at the cover a
  book shows and `cover_override` records that the user chose it; the served
  `coverUrl` is computed from the asset id, no URL is stored. Deleting a book
  leaves the file; a GC removes assets nothing references any more.
- **Types are portable.** See [ADR 0002](adr/0002-database-adapter-layer.md)
  for why timestamps and arrays are stored as text.

The authoritative definitions are `apps/api/drizzle/migrations/*.sql`
(DDL, applied in order), `apps/api/src/db/schema/*.ts` (Drizzle) and
`packages/shared/src/schemas/*.ts` (Zod, wire format).
