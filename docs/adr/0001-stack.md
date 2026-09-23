# ADR 0001 — Application stack

- Status: accepted; the Runtime row is superseded by [ADR 0006](0006-node-26-runtime.md) (Node 26)
- Date: 2026-09-19

## Context

Bookguardian is a mobile-first personal library manager: a web SPA (installable
PWA) plus a small REST API. The project owner fixed the stack up front so that
every issue starts from the same foundation; this record captures that decision
and the reasoning, so later deviations are made consciously (as new ADRs).

## Decision

| Concern          | Choice                                                                             |
| ---------------- | ---------------------------------------------------------------------------------- |
| Repository       | pnpm workspaces monorepo: `apps/web`, `apps/api`, `packages/shared`                |
| Runtime          | Node 22 (`.nvmrc`, `engines`), TypeScript strict everywhere — see ADR 0006         |
| Frontend         | React 19 + Vite 7, TanStack Router (file-based), TanStack Query, `vite-plugin-pwa` |
| i18n             | `i18next` + `react-i18next`; `en` is the source locale; strings live in `shared`   |
| Backend          | Hono on `@hono/node-server`, REST JSON, Zod validation via `@hono/zod-validator`   |
| Validation/types | Zod 4 schemas in `packages/shared`, inferred TS types, shared by web and api       |
| Data             | Drizzle ORM behind a repository layer; SQLite default, Postgres/MySQL selectable   |
| Book metadata    | Open Library first, Google Books fallback (`apps/api/src/lookup`)                  |
| Scanning         | `@zxing/browser` for ISBN barcodes, `tesseract.js` for on-device OCR (lazy-loaded) |
| Tooling          | ESLint 9 (flat config, type-aware) + Prettier, Vitest, Playwright, GitHub Actions  |

Supporting choices made while bootstrapping:

- **`tsup` bundles the API** (`apps/api/dist/index.js`) and inlines
  `@bookguardian/shared`, which ships TypeScript sources. This keeps the shared
  package build-free while still producing a plain `node dist/index.js`
  deployable.
- **`routeTree.gen.ts` is committed.** TanStack Router regenerates it on every
  `vite dev`/`vite build`; committing it lets `tsc` and ESLint run without a
  prior Vite pass (e.g. in CI's typecheck job).
- **`eslint-plugin-i18next/no-literal-string`** runs in error mode on
  `apps/web/src/**/*.tsx` (JSX text and `aria-label`/`title`/`placeholder`/`alt`
  attributes). A hard-coded UI string fails `pnpm lint`.
- **Playwright runs the iPhone 14 device descriptor on Chromium.** The device
  gives the 390px viewport, touch and mobile UA; Chromium avoids WebKit system
  dependencies on CI. Switch `browserName` to `webkit` locally for Safari checks.

Supply-chain rules adopted with the stack:

- pnpm `minimumReleaseAge: 10080` (7 days) — no freshly published version is
  ever resolved; `scripts/check-release-age.mjs` re-checks the lockfile in CI.
- Lockfile is frozen in CI, lifecycle scripts are allow-listed
  (`onlyBuiltDependencies`), GitHub Actions are pinned to commit SHAs.

## Consequences

- One TypeScript toolchain and one set of Zod schemas across the stack; DTOs
  never drift between client and server.
- All user-facing copy must be added to `packages/shared/src/i18n/en.json`
  first; the lint rule will reject literals.
- Database portability constrains the schema (see ADR 0002).
