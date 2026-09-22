# syntax=docker/dockerfile:1
#
# Bookguardian — one container serving the API and the web app on one port,
# SQLite on the /data volume.
#
#   docker compose up --build        # http://localhost:3000, DB in ./data
#
# Stages: deps (install, release-age rule enforced by pnpm) → build (tsup +
# vite) → runtime (slim Node 22, production deps only, non-root).

# ---- base ------------------------------------------------------------------
# Pinned Node 22 LTS on Debian bookworm, by digest. Dependabot bumps this line
# (.github/dependabot.yml, "docker" ecosystem) — it only sees image references
# written directly on a FROM, so the digest lives here and not behind an ARG.
# Both the build and the runtime stage derive from it: one pin to review.
FROM node:26.8.2-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS base

# ---- deps ------------------------------------------------------------------
FROM base AS deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm version comes from "packageManager" in package.json (single source of truth).
RUN corepack enable pnpm
WORKDIR /app

# Manifests only, so the install layer is cached until a dependency changes.
# pnpm-workspace.yaml carries minimumReleaseAge: 10080 (no package < 7 days old).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# ---- build -----------------------------------------------------------------
FROM deps AS build
COPY . .
# No VITE_API_URL here on purpose: the SPA keeps relative /api URLs, so it works
# behind whatever host/tunnel the container is reached through. PUBLIC_ORIGIN is
# the one exception: the landing page's Open Graph tags want absolute URLs, and
# a crawler never runs our JS. Unset (the default) leaves those tags relative —
# correct anywhere, no absolute image URL for a chat unfurl — so a real
# deployment sets it to the same value as AUTH_BASE_URL
# (`docker build --build-arg PUBLIC_ORIGIN=https://books.example.com`, or
# PUBLIC_ORIGIN in the compose .env).
ARG PUBLIC_ORIGIN=""
ENV PUBLIC_ORIGIN=${PUBLIC_ORIGIN}
RUN pnpm build
# Standalone production node_modules for the API (shared package is bundled by tsup).
RUN pnpm --filter @bookguardian/api --prod deploy --legacy /out/api

# ---- runtime ---------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DB_DRIVER=sqlite \
    DATABASE_PATH=/data/bookguardian.db \
    WEB_DIST=/app/web
WORKDIR /app

COPY --from=build --chown=node:node /out/api/package.json ./
COPY --from=build --chown=node:node /out/api/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
COPY --from=build --chown=node:node /app/apps/api/drizzle ./drizzle
COPY --from=build --chown=node:node /app/apps/web/dist ./web

# The database lives on a volume; the image itself stays read-only in practice.
RUN mkdir -p /data && chown node:node /data
VOLUME /data

USER node
EXPOSE 3000

# Liveness only (no DB round-trip); the app runs migrations + seed at boot.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health?shallow=true').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
