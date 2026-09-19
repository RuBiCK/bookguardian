# Bookguardian

Mobile-first personal library manager: track your books, where they live
(library → shelf), who you lent them to, ratings, read dates and stats. Think
Goodreads for your own physical shelves, optimised for one-handed phone use.

- **`apps/web`** — React 19 + Vite PWA (TanStack Router/Query, i18next).
- **`apps/api`** — Hono REST API on Node 22, Drizzle ORM behind a database
  adapter layer (SQLite by default; Postgres/MySQL selectable).
- **`packages/shared`** — Zod schemas, inferred types, API DTOs and the `en`
  i18n dictionary, consumed by both apps.

## Quick start

Requirements: Node 22 (`.nvmrc`) and pnpm 10 (`corepack enable` or
`npm i -g pnpm`).

```bash
pnpm install
pnpm db:migrate   # creates apps/api/data/bookguardian.db and applies migrations
pnpm db:seed      # one local user, "My Library" and a "Default" shelf
pnpm dev          # API on http://localhost:3000, web on http://localhost:5173
```

Open <http://localhost:5173> in a phone-sized viewport (or install it as a PWA).
The Vite dev server proxies `/api` to the API, so the SPA uses relative URLs.

## Scripts

| Command           | What it does                                                      |
| ----------------- | ----------------------------------------------------------------- |
| `pnpm dev`        | Run API (`tsx watch`) and web (`vite`) together                   |
| `pnpm build`      | Build every package (`apps/api/dist`, `apps/web/dist`)            |
| `pnpm lint`       | ESLint (type-aware, i18n literal guard) + Prettier check          |
| `pnpm lint:fix`   | Auto-fix lint and formatting                                      |
| `pnpm typecheck`  | `tsc --noEmit` in every package                                   |
| `pnpm test`       | Vitest unit tests in every package                                |
| `pnpm test:e2e`   | Playwright smoke test on an iPhone 14 viewport (builds web first) |
| `pnpm db:migrate` | Apply pending SQL migrations to the configured database           |
| `pnpm db:seed`    | Idempotent seed (user + default library/shelf)                    |

First e2e run: `pnpm --filter @bookguardian/web exec playwright install chromium`.

## Run with Docker

One container serves the API and the web app on the same origin, with the
SQLite database on a `/data` volume — the easiest way to try the built app on
a phone, and the shape the Coolify deployment will use.

```bash
cp .env.example .env      # optional: GOOGLE_BOOKS_API_KEY etc.
mkdir -p data             # Linux: create it first so it is owned by you, not root
docker compose up --build # http://localhost:3000
```

- **Where the database lives:** `./data/bookguardian.db` on the host (bind
  mounted at `/data`; WAL side files `-wal`/`-shm` sit next to it). Migrations
  and the default "My Library / Default" seed run at boot.
- **Reset the library:** `docker compose down && rm -rf data && docker compose up`.
- **Configuration:** the container reads the repo-root `.env` (if present);
  `DATABASE_PATH=/data/bookguardian.db`, `PORT=3000` and `WEB_DIST=/app/web` are
  pinned in `docker-compose.yaml` and win over `.env`. The image runs as the
  non-root `node` user (uid 1000) and exposes a `HEALTHCHECK` on
  `/api/health?shallow=true`.
- **Camera on your phone needs HTTPS.** Browsers only expose `getUserMedia`
  on secure origins, so `http://<your-laptop-ip>:3000` will show the barcode
  and cover screens without a live camera (photo picker and typed ISBN still
  work). For the full Scan tab, put a tunnel in front of the container:

  ```bash
  cloudflared tunnel --url http://localhost:3000
  ```

  and open the printed `https://….trycloudflare.com` URL on the phone (also
  installable as a PWA from there).

The image is built in CI on every PR (`docker build` + a health/SPA smoke run,
no push). `WEB_DIST` is what makes the API serve the SPA (static files plus
`index.html` fallback for client routes; `/api/*` is untouched) — leave it unset
for `pnpm dev`, where Vite serves the app and proxies `/api`.

## Supply-chain policy

- **No package younger than 7 days.** `pnpm-workspace.yaml` sets
  `minimumReleaseAge: 10080`, so pnpm refuses to resolve any version published
  less than a week ago (compromised releases are usually caught and pulled
  within days). `pnpm audit:age` re-verifies the committed lockfile against the
  registry and runs as its own CI job, so a hand-edited lockfile cannot bypass
  the rule. If a fresh release is genuinely required, wait, or add the package
  to `minimumReleaseAgeExclude` in a reviewed PR with a justification.
- **Frozen lockfile in CI** (`pnpm install --frozen-lockfile`).
- **Install scripts are opt-in**: only packages listed under
  `onlyBuiltDependencies` may run lifecycle scripts.
- **GitHub Actions are pinned to commit SHAs**, not mutable tags.
- Playwright browsers and Docker images used by tests are pinned by version.

## Configuration

Copy `.env.example` to `.env` (repo root or `apps/api/`) and adjust:

| Variable        | Default                  | Notes                                             |
| --------------- | ------------------------ | ------------------------------------------------- |
| `PORT`          | `3000`                   | API port                                          |
| `DB_DRIVER`     | `sqlite`                 | `sqlite` \| `postgres` \| `mysql`                 |
| `DATABASE_PATH` | `./data/bookguardian.db` | SQLite file (relative to `apps/api`)              |
| `DATABASE_URL`  | —                        | Required for `postgres` / `mysql`                 |
| `WEB_DIST`      | —                        | Built SPA dir to serve from the API (Docker)      |
| `VITE_API_URL`  | `http://localhost:3000`  | Where Vite proxies `/api`; also baked into builds |

### Switching the database driver

The API talks to the database only through `apps/api/src/db/adapters/*`. Pick
the engine with one variable; the same migrations run everywhere:

```bash
# Postgres
DB_DRIVER=postgres DATABASE_URL=postgres://user:pass@localhost:5432/bookguardian pnpm db:migrate

# MySQL
DB_DRIVER=mysql DATABASE_URL=mysql://user:pass@localhost:3306/bookguardian pnpm db:migrate
```

Only SQLite is exercised by the test suite today; Postgres/MySQL are a
later milestone (the adapters exist so the schema and repositories stay
portable from day one). See [ADR 0002](docs/adr/0002-database-adapter-layer.md)
for the design.

## Project layout

```
apps/
  api/
    drizzle/migrations/   portable SQL migrations (one set for all drivers)
    src/
      app.ts              Hono app factory (routes, error envelope)
      web-app.ts          serves apps/web/dist + SPA fallback when WEB_DIST is set
      config.ts           env parsing (Zod)
      routes/             HTTP handlers, Zod-validated
      db/adapters/        sqlite | postgres | mysql — the only dialect-specific code
      db/schema/          Drizzle tables per dialect (kept in parity by a test)
      db/repositories/    dialect-agnostic data access
      inventory.ts        library/shelf/book use-cases (defaults, cascade rules)
      owner.ts            resolves the owner every query is scoped by
      db/migrate.ts       migration runner    db/seed.ts  seed
  web/
    src/routes/           TanStack file routes (tabs + libraries/$id, shelves/$id, books/$id)
    src/components/       app shell + inventory UI (Sheet, BookSheet, BookGrid, ShelfPicker…)
    src/theme/            CSS variables (light/dark) + theme hook
    src/api/              typed fetch client + TanStack Query hooks
    e2e/                  Playwright (iPhone 14)
packages/shared/
  src/schemas/            Zod entities   src/dto/  API DTOs   src/i18n/  en.json
docs/
  adr/                    architecture decision records
  data-model.md           ER diagram and field notes
Dockerfile / docker-compose.yaml   single-container build (API + SPA, SQLite on /data)
```

## Conventions

- Every user-facing string goes through `t('key')`; keys live in
  `packages/shared/src/i18n/en.json`. `pnpm lint` fails on JSX literals.
- Every list has an empty state, every action is optimistic, everything must
  work with one thumb on a 390px-wide screen. Light and dark themes from day one.
- One PR per issue, opened only after `pnpm lint && pnpm typecheck && pnpm test`
  pass locally. CI runs the same plus a build and the e2e smoke test.
- Deviations from the stack are recorded as ADRs in `docs/adr/`.

## API

| Method   | Path                                     | Description                                                                                                                                                    |
| -------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/health`                            | `{ status, version, uptimeSeconds, database: { driver, reachable } }` (`?shallow=true` skips the DB ping)                                                      |
| `GET`    | `/api/defaults`                          | `{ libraryId, shelfId }` — where a new book lands when no shelf is given (most recently used shelf, else the first one)                                        |
| `GET`    | `/api/libraries`                         | `{ items: LibraryWithCounts[] }` (`shelfCount`, `bookCount`)                                                                                                   |
| `POST`   | `/api/libraries`                         | Create `{ name, location? }` → 201                                                                                                                             |
| `GET`    | `/api/libraries/:id`                     | One library with counts                                                                                                                                        |
| `PATCH`  | `/api/libraries/:id`                     | Update `{ name?, location? }`                                                                                                                                  |
| `DELETE` | `/api/libraries/:id[?moveBooksTo=shelf]` | Delete library + shelves. 409 `library_not_empty` if it holds books and no destination is given; 409 `last_library` for the only library → `{ movedBooks }`    |
| `GET`    | `/api/shelves[?libraryId=]`              | `{ items: ShelfWithCount[] }` ordered by `sortOrder`                                                                                                           |
| `POST`   | `/api/shelves`                           | Create `{ libraryId, name, sortOrder? }` (appends by default) → 201                                                                                            |
| `POST`   | `/api/shelves/reorder`                   | `{ libraryId, shelfIds }` — must list every shelf of the library once                                                                                          |
| `GET`    | `/api/shelves/:id`                       | One shelf with `bookCount`                                                                                                                                     |
| `PATCH`  | `/api/shelves/:id`                       | Update `{ name?, sortOrder? }`                                                                                                                                 |
| `DELETE` | `/api/shelves/:id[?moveBooksTo=shelf]`   | Delete shelf. 409 `shelf_not_empty` without a destination; 409 `last_shelf` for a library's only shelf → `{ movedBooks }`                                      |
| `GET`    | `/api/books`                             | `{ items, total, limit, offset }`. Filters: `q` (title/subtitle/authors/publisher/ISBN), `libraryId`, `shelfId`, `readStatus`, `category`, `sort=added\|title` |
| `POST`   | `/api/books`                             | Create; only `title` is required, `shelfId` defaults to `/api/defaults` → 201                                                                                  |
| `GET`    | `/api/books/:id`                         | One book                                                                                                                                                       |
| `PATCH`  | `/api/books/:id`                         | Partial update (any book field, including `shelfId`)                                                                                                           |
| `POST`   | `/api/books/:id/move`                    | `{ shelfId }` → the moved book                                                                                                                                 |
| `DELETE` | `/api/books/:id`                         | → 204                                                                                                                                                          |
| `GET`    | `/api/lookup/isbn/:isbn`                 | Catalogue metadata for an ISBN-10/13 (hyphens allowed) as a `BookDraft`; 404 `isbn_not_found`, 503 `lookup_unavailable` when every provider is down            |
| `GET`    | `/api/lookup/search?q=&limit=`           | `{ items: BookDraft[] }` — free-text title/author search (limit 1–10, default 5)                                                                               |

Every query is scoped to the owner resolved by `apps/api/src/owner.ts` (the single
local user for now; the seed runs on first contact so a fresh database already
has "My Library" with a "Default" shelf).

Errors always use the shared envelope `{ error: { code, message, details? } }`.

### Book metadata lookup

`/api/lookup/*` asks **Open Library** first and falls back to **Google Books**
when it has no record (`apps/api/src/lookup/`). Provider replies are normalised
into the shared `BookDraft` schema (ISBN-10 and -13 both filled in, BCP-47
language, https cover URL) and cached in memory per ISBN / per query
(`LOOKUP_CACHE_TTL_SECONDS`, default one day). One provider failing is logged
and skipped; only when all of them fail does the API answer 503 so the app can
say "try again" instead of "unknown book". Google's anonymous quota is tiny —
set `GOOGLE_BOOKS_API_KEY` for anything beyond local testing. Tests run against
recorded fixtures in `apps/api/test/fixtures/lookup/`.

### Scan tab (web)

- **ISBN barcode** — live rear-camera scanning with `@zxing/browser`
  (EAN-13, Bookland 978/979 prefixes only), a "choose a photo" fallback that
  decodes a screenshot or gallery picture, and a typed-ISBN field. Camera
  permission denied / no camera / insecure context all degrade to the photo and
  typed paths.
- **Book cover** — take or pick a photo, run on-device OCR with `tesseract.js`
  (English), turn the text into search queries (`apps/web/src/lib/ocr-query.ts`)
  and show up to five candidates. A printed ISBN on the photo short-circuits to
  the ISBN lookup.
- Every path ends in the same bottom sheet: one tap adds the book to the
  default shelf, or "Edit details" opens the full add form pre-filled.

`@zxing` and `tesseract.js` are loaded lazily on the Scan tab. tesseract.js
fetches its worker, WASM core and the `eng` traineddata from its CDNs on first
use and caches them in the browser, so cover OCR needs the network the first
time (and the app is offline-tolerant otherwise). The e2e suite exercises real
barcode decoding from a rendered image; the real OCR test only runs with
`E2E_NETWORK=1`.
