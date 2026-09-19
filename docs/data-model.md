# Data model

Canonical names come from the project brief: **Library → Shelf → Book**, plus
**Lending** and **LibraryShare**. Every aggregate carries `owner_id`; sharing is
modelled from the first migration so multi-user arrives without a schema
rewrite.

```mermaid
erDiagram
    USERS ||--o{ LIBRARIES : owns
    USERS ||--o{ SHELVES : owns
    USERS ||--o{ BOOKS : owns
    USERS ||--o{ LENDINGS : owns
    USERS ||--o{ LIBRARY_SHARES : "is grantee of"
    LIBRARIES ||--o{ SHELVES : contains
    LIBRARIES ||--o{ LIBRARY_SHARES : "shared via"
    SHELVES ||--o{ BOOKS : holds
    BOOKS ||--o{ LENDINGS : "lent as"

    USERS {
        varchar(36) id PK
        varchar(120) display_name
        varchar(254) email "nullable"
        varchar(32) created_at "ISO-8601"
        varchar(32) updated_at "ISO-8601"
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
        varchar(2048) cover_url "nullable"
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
```

## Notes

- **Ownership.** `owner_id` on libraries, shelves, books and lendings is
  denormalised on purpose: every repository query filters by owner without a
  join, and a future multi-user API can enforce tenancy in one place.
- **Sharing.** `library_shares(library_id, grantee_id)` is unique; `role` is
  `viewer` only for now. Read-only sharing means a grantee can list a library's
  shelves and books but never write.
- **Reading state.** `read_status` is one of `to_read`, `reading`, `read`;
  `read_at` is a local calendar day (`YYYY-MM-DD`, no time, no UTC shift) and
  is only ever set when the status is `read`: marking a book read without a
  date stamps today, an existing date survives re-marking, and any other
  status clears it (`resolveReadAt` in `packages/shared`). Future dates are
  rejected by the shared `readAtSchema`, on the API and in the web form alike.
- **Lending.** A lending is open while `returned_at` is `NULL`; the
  `(owner_id, returned_at)` index serves the "what's lent out" list.
- **Deletes cascade** down the hierarchy (user → library → shelf → book →
  lending) so removing a library never leaves orphans.
- **Types are portable.** See [ADR 0002](adr/0002-database-adapter-layer.md)
  for why timestamps and arrays are stored as text.

The authoritative definitions are `apps/api/drizzle/migrations/0001_initial.sql`
(DDL), `apps/api/src/db/schema/*.ts` (Drizzle) and
`packages/shared/src/schemas/*.ts` (Zod, wire format).
