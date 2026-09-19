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

## Configuration

Copy `.env.example` to `.env` (repo root or `apps/api/`) and adjust:

| Variable        | Default                  | Notes                                             |
| --------------- | ------------------------ | ------------------------------------------------- |
| `PORT`          | `3000`                   | API port                                          |
| `DB_DRIVER`     | `sqlite`                 | `sqlite` \| `postgres` \| `mysql`                 |
| `DATABASE_PATH` | `./data/bookguardian.db` | SQLite file (relative to `apps/api`)              |
| `DATABASE_URL`  | —                        | Required for `postgres` / `mysql`                 |
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

SQLite is exercised by the automated tests; the Postgres and MySQL adapters are
wired and compile but are not yet covered by CI. See
[ADR 0002](docs/adr/0002-database-adapter-layer.md) for the design.

## Project layout

```
apps/
  api/
    drizzle/migrations/   portable SQL migrations (one set for all drivers)
    src/
      app.ts              Hono app factory (routes, error envelope)
      config.ts           env parsing (Zod)
      routes/             HTTP handlers, Zod-validated
      db/adapters/        sqlite | postgres | mysql — the only dialect-specific code
      db/schema/          Drizzle tables per dialect (kept in parity by a test)
      db/repositories/    dialect-agnostic data access
      db/migrate.ts       migration runner    db/seed.ts  seed
  web/
    src/routes/           TanStack file routes (one per bottom tab)
    src/components/       app shell pieces (TabBar, Screen, EmptyState)
    src/theme/            CSS variables (light/dark) + theme hook
    src/api/              typed fetch client + TanStack Query hooks
    e2e/                  Playwright (iPhone 14)
packages/shared/
  src/schemas/            Zod entities   src/dto/  API DTOs   src/i18n/  en.json
docs/
  adr/                    architecture decision records
  data-model.md           ER diagram and field notes
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

| Method | Path          | Description                                                                                               |
| ------ | ------------- | --------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/health` | `{ status, version, uptimeSeconds, database: { driver, reachable } }` (`?shallow=true` skips the DB ping) |

Errors always use the shared envelope `{ error: { code, message, details? } }`.
