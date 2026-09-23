# ADR 0006 — Node 26 as the runtime, and pnpm without Corepack

- Status: accepted (supersedes the Runtime row of [ADR 0001](0001-stack.md))
- Date: 2026-09-23

## Context

[ADR 0001](0001-stack.md) fixed the runtime at Node 22. Dependabot's weekly
Docker update then opened [PR #21](https://github.com/RuBiCK/bookguardian/pull/21),
bumping the base image from `node:22.23.2-bookworm-slim` to
`node:26.8.2-bookworm-slim`, and the `Docker · build image + smoke run` job
went red on the first instruction of the `deps` stage:

```
#11 [deps 1/7] RUN corepack enable pnpm
#11 0.124 /bin/sh: 1: corepack: not found
```

The Node 26 images no longer ship Corepack (verified: `node:26.8.2-bookworm-slim`
has `node` and `npm` 11, no `corepack`, no `curl`). So the bump is two
decisions, not one: which Node line this project should be on, and how pnpm
gets into the image once Corepack is gone.

The release calendar for the lines in play (`nodejs/Release`, `schedule.json`,
read 2026-09-23):

| Line         | Current from | Active LTS from | Maintenance from | End of life |
| ------------ | ------------ | --------------- | ---------------- | ----------- |
| 22 "Jod"     | 2024-04-24   | 2024-10-29      | 2025-10-21       | 2027-04-30  |
| 24 "Krypton" | 2025-05-06   | 2025-10-28      | 2026-10-20       | 2028-04-30  |
| 26           | 2026-05-05   | 2026-10-28      | 2027-10-20       | 2029-04-30  |

## Decision

Move the whole project — Docker base image, `.nvmrc`, `engines`, `@types/node`,
CI (which reads `.nvmrc`) and the docs — to **Node 26**, and install pnpm in the
image with plain `npm install --global`, reading the version from the
`packageManager` field of `package.json` at build time.

**Why not stay on 22.** It has been security-fix-only since 2025-10-21 and dies
on 2027-04-30. Staying means no feature or performance work reaches us, and
Dependabot re-opens this same PR every Monday.

**Why not 24, the line that is Active LTS today.** It enters maintenance on
2026-10-20 — four weeks from this decision. Adopting it buys four weeks of
active support and then bills us for a second migration to 26 almost
immediately. The "always be on Active LTS" rule of thumb produces the worse
outcome here precisely because we are standing at the seam between two lines.

**Why 26.** It becomes Active LTS on 2026-10-28, five weeks away, and is
supported until 2029-04-30 — the longest-lived line available, reached in one
migration instead of two. The five weeks spent on a Current release are bounded
risk for this project: the base image is pinned by digest, every bump passes
lint, typecheck, unit tests with coverage thresholds, a production build, a
Docker build with a container smoke run and the iPhone-14 Playwright suite
before it can merge, and a rollback is a three-line revert.

**Why `npm install --global` rather than re-adding Corepack.** Corepack would
have to be installed from npm first and would then download pnpm from npm
anyway — the same trust boundary, one more moving part. `npm` is already in the
image. The pnpm version is parsed out of `packageManager` in `package.json`
inside the build, so that field stays the single source of truth and no second
copy of the version appears in the Dockerfile:

```dockerfile
COPY package.json ./
RUN PNPM_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]")" \
    && npm install --global --no-fund "pnpm@${PNPM_VERSION}" \
    && pnpm --version
```

## Consequences

- Contributors need Node 26 locally (`nvm use` reads `.nvmrc`); `engines` is
  `>=26 <27`, so pnpm warns on a mismatch. `corepack enable` is no longer a
  valid way to get pnpm — the README says `npm i -g pnpm`.
- `@types/node` moves to `^26` in `apps/api` and `packages/shared`, so the types
  describe the runtime the code actually runs on.
- Copying `package.json` on its own ahead of the other manifests means an edit
  to it re-runs the global pnpm install layer. That is one small npm download on
  a layer that was already invalidated by the same edit.
- Nothing to do on 2026-10-28; the pinned line simply becomes LTS. Dependabot
  keeps bumping the patch inside it.
- If Node 26 turns out to be wrong for us, the revert is the `FROM` digest,
  `.nvmrc`, `engines` and `@types/node` — no application code depends on the
  major.
