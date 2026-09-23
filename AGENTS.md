# AGENTS.md

Working rules for any AI coding harness (Claude Code, Codex, Cursor, Copilot,
Multica runs, …) contributing to this repository. Humans are welcome to follow
them too.

## What this is

Bookguardian is a mobile-first personal library manager: a web SPA (installable
PWA) plus an API for tracking books, where they live (library → shelf),
lending, ratings, read dates and statistics. Think Goodreads for your own
physical shelves, optimised for one-handed phone use. All work lands through
branches and pull requests against `main`.

## Stack (decided — do not re-litigate)

Deviations are recorded as an ADR in `docs/adr/`, never applied silently.

- Monorepo (pnpm workspaces): `apps/web` (frontend), `apps/api` (backend),
  `packages/shared` (types, validation schemas, i18n keys).
- Frontend: React 19 + TypeScript + Vite, PWA, mobile-first. Routing: TanStack
  Router. Server state: TanStack Query. i18n: `i18next` + `react-i18next`;
  English is the source locale and every user-facing string goes through a
  translation key.
- Backend: Node 26 + TypeScript + Hono, REST JSON API, Zod validation shared
  with the frontend.
- Data: Drizzle ORM behind a repository layer (`apps/api/src/db/adapters/*`).
  SQLite (better-sqlite3) is the only supported and tested driver for now.
  Keep queries and migrations portable (no driver-specific SQL in application
  code) so Postgres/MySQL can be added later — but do NOT build, test,
  document or spend time on Postgres/MySQL until an issue explicitly asks.
- Book metadata: Open Library first, Google Books as fallback. ISBN barcode via
  `@zxing/browser`; text OCR on-device with `tesseract.js`.
- Tooling: ESLint + Prettier, Vitest, Playwright for mobile-viewport e2e,
  GitHub Actions CI on every PR.

## Domain model (canonical names)

Library (name, location) → Shelf (name, sort order) → Book (isbn10/13, title,
subtitle, authors[], publisher, published date, pages, language, cover url,
categories[], description, notes, rating 0–5, read status: `to_read` /
`reading` / `read`, read_at, added_at). Lending (book, borrower name/contact,
lent_at, due_at, returned_at).

Every aggregate carries `owner_id`, and a `library_shares` table (library,
grantee, role: viewer) exists from the first migration even though single-user
is the MVP — multi-user and read-only library sharing arrive later without a
schema rewrite. Use these names in code, schemas, routes and translation keys.

## UX rules

- Fewest taps possible. A fresh install already has a "My Library" with a
  "Default" shelf; adding a book never requires picking a library or shelf
  unless the user wants to.
- Every list has a good empty state, every action has optimistic UI, and
  everything works with one thumb on a 390px-wide screen.
- Dark mode and light mode from day one.

## Delivery rules

- **Supply-chain rule:** never install a package version published less than
  7 days ago. `pnpm-workspace.yaml` sets `minimumReleaseAge: 10080` and CI
  re-verifies the lockfile with `pnpm audit:age`. Keep both intact, never
  bypass them (no `minimumReleaseAgeExclude`, no hand-edited lockfile), and
  re-check before adding a new dependency.
- **Tests are part of every deliverable:** unit tests for logic, API
  integration tests against SQLite, Playwright e2e on the iPhone 14 viewport
  for user-facing flows. No PR without tests for what it adds.
- **One PR per issue,** small enough to review. Link the PR on the issue.
- **Before opening a PR, run locally the same checks CI runs** (see
  [Commands](#commands)): `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  Playwright e2e for touched user-facing flows, and the release-age check.
  Fix everything before pushing.
- **Green CI is the acceptance gate for every issue.** After pushing the PR,
  wait for CI in one foreground blocking call: `gh pr checks <pr> --watch`.
  If any check fails, read the failed job's logs
  (`gh run view <run-id> --log-failed`), fix the cause, push, and watch again.
  Repeat until every check is green. Never hand off, mark done or request
  review with red, pending or unchecked CI.
- **The final report must state the CI result explicitly** — workflow name,
  run link, all checks passing. "CI is still running" is not a valid hand-off.
- Issue bodies get no H1; the issue title is the H1.

## Commands

These are the real scripts from `package.json` and the steps in
`.github/workflows/ci.yml`. Requirements: Node 26 (`.nvmrc`) and pnpm 10
(`packageManager` field).

```bash
pnpm install --frozen-lockfile   # minimumReleaseAge enforced by pnpm
pnpm db:migrate                  # create apps/api/data/bookguardian.db + migrate
pnpm dev                         # API on :3000, web on :5173
```

What CI runs (workflow **CI**, jobs in `.github/workflows/ci.yml`):

| CI job                               | Local equivalent                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Supply chain · lockfile release age  | `pnpm audit:age` (`node scripts/check-release-age.mjs --days 7`)                                    |
| Lint · Typecheck · Test · Build      | `pnpm lint` → `pnpm typecheck` → `pnpm test:coverage` → `pnpm build`                                |
| Docker · build image + smoke run     | `docker build --tag bookguardian:ci .` then run it and hit `/api/health`                            |
| E2E · iPhone 14 viewport (web + API) | `pnpm --filter @bookguardian/web exec playwright install --with-deps chromium` then `pnpm test:e2e` |

Notes:

- `pnpm lint` is `eslint . && prettier --check .` — Prettier also checks
  Markdown, YAML and JSON. Use `pnpm lint:fix` or `pnpm format` to fix.
- `pnpm test` runs Vitest in every workspace; CI uses `pnpm test:coverage`,
  which additionally enforces coverage thresholds — run that one before
  pushing when you touched tests or added code.
- `pnpm test:e2e` runs Playwright from `apps/web` (specs in `apps/web/e2e/`).
  CI only runs it once the lint/typecheck/test/build job is green.
- The Docker job is only needed locally when you change the `Dockerfile`,
  `docker-compose*.yaml`, `.dockerignore` or the API boot/health path.
