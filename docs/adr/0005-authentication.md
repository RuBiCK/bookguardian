# ADR 0005 — Google sign-in (server-side OIDC), database sessions, one account per email

- Status: accepted
- Date: 2026-09-20

## Context

Until BOOK-12 the API had exactly one user, created by the seed and picked
by `owner.ts` for every request. Every aggregate already carried `owner_id`
and every repository already filtered by it, so "real accounts" was a matter
of deciding who the caller is. Constraints from the brief:

- A personal, self-hosted app used from a phone; the owner does not want to
  run a password database, and nobody else should be able to create an
  account on their instance unless invited.
- The library that already exists on the deployed instance must survive the
  switch and end up owned by the person who has been using it.
- Multi-user and read-only sharing (`library_shares`) arrive later; the
  identity model must not need a rewrite for them.

## Decision

Diagrams of the deployment, the flow and the threat/control map are in
[docs/auth.md](../auth.md); this record keeps the reasoning.

### One origin: the SPA and the API share a host

Since BOOK-8 one container serves the SPA's static files and the API, and
the SPA calls the API with relative `/api` URLs — no `VITE_API_URL` in the
production build. Authentication builds on that instead of on a split
`app.` / `api.` setup: the `bg_session` cookie is host-only (`Path=/`, no
`Domain`), it travels with every same-origin request, and there is no CORS
with credentials, no `credentials: 'include'` and no `WEB_URL` to redirect
back to. `AUTH_BASE_URL` is therefore the single public origin, and the
redirect URI registered in Google Cloud is
`${AUTH_BASE_URL}/api/auth/google/callback`. In development the Vite proxy
keeps the same picture (the browser only sees `localhost:5173`), and the
Playwright suite goes through `vite preview`'s proxy for the same reason.

Splitting the hosts one day would take, in this order and none of it now:
a CORS policy on `/api/*` with an explicit `origin` (the SPA's) and
`Access-Control-Allow-Credentials: true` instead of today's `*`;
`credentials: 'include'` on every `fetch` in `apps/web/src/api`;
`VITE_API_URL` baked into the web build; a `WEB_URL` for the callback's
final redirect (`return_to` is validated as a path relative to the API's
origin today); and, if the hosts are not even same-site, dropping
`SameSite=Lax` for `None` — which would also remove the CSRF protection Lax
gives for free. That is a lot of surface for no gain on a single-container
deployment, hence the decision.

### Google via OpenID Connect, authorization code + PKCE, handled by the API

The SPA links to `GET /api/auth/google`; the API builds the authorization
URL (`arctic`), keeps `state`, the PKCE verifier and a `nonce` in a signed,
10-minute, `httpOnly` cookie scoped to `/api/auth`, and on the callback
exchanges the code and verifies the `id_token` with `jose` against Google's
JWKS (signature, `iss`, `aud`, `exp`, `nonce`). Discovery and keys are cached
in memory. The browser never sees an access token or id_token, there is no
client-side OAuth library, and the only secret is on the server.

`email_verified` must be true; an unverified address is `403
email_not_verified`. Other providers are not offered, but the model below
already keys identities by `(provider, subject)`, so adding one is a new
provider client, not a schema change.

### Sessions live in the database, not in a JWT

`bg_session` is a random 32-byte token; the `sessions` row stores its SHA-256,
`expires_at`, `last_seen_at` and the user agent. The cookie is `httpOnly`,
`SameSite=Lax`, `Secure` on https, `Path=/`, 30 days, sliding (renewed on use
past the halfway point). Logout deletes the row; expired rows are purged on
the same daily timer as the cover GC.

A stateless JWT session was rejected: it cannot be revoked (logout, a lost
phone, a removed account) without an allow/deny list — which is a database
session with extra steps — and it ships claims to the client that the client
does not need. The one query per request the database session costs is
nothing next to the queries the request makes anyway.

### One account per email

`users.email` is lower-cased on write and has a UNIQUE index. Resolving a
verified provider profile (`auth/account.ts`) goes, in one transaction:

1. `auth_identities(provider, subject)` exists → that user.
2. A user with that email exists → the identity is linked to it. Two users
   with the same email can never exist, whichever provider brought them.
3. First sign-in ever on an instance seeded before accounts (no identity
   anywhere, exactly one email-less user) → that user is **claimed**: it
   receives the email, name and avatar and keeps its libraries.
4. Otherwise create user + identity — unless `AUTH_ALLOWED_EMAILS` is set and
   the email is not on it (`403 not_allowed`, nothing written). The list also
   guards the claim; it does not lock out users that already exist. The
   value is parsed leniently (commas, spaces, semicolons or newlines
   separate entries; case is folded) because it is typed into a dashboard,
   not a config file.

Concurrent sign-ins for the same new email are serialised by the SQLite
adapter (one transaction at a time per connection); on any engine the UNIQUE
index is the backstop, and a sign-in that trips it is retried once and lands
on step 2.

### `users.email` stays nullable in DDL

The rule is "every account has an email", but the column is declared `NULL`
with a UNIQUE index rather than `NOT NULL`: the local user of a pre-accounts
database has no email until it is claimed, SQLite cannot `ALTER COLUMN`
(a table rebuild would cascade-delete every library through the foreign
keys unless foreign keys were switched off — driver-specific SQL the
migration rules forbid), and all three engines treat NULLs as distinct in a
unique index. The API never creates an email-less user any more; the seed
only does so under an explicit `--local-user` flag (tests, development).

### Allow-list rather than "invite" flow

`AUTH_ALLOWED_EMAILS` is the whole invitation system for now: a personal
instance lists the one or two addresses that may create an account, and
anyone else who signs in with Google gets `403 not_allowed` without a row
being written. Existing accounts keep working when the list changes. A
proper invitation table can replace it when sharing arrives.

## Consequences

- `ownerMiddleware` is gone; `authMiddleware` puts `ownerId` (and `user`)
  on the context from the session, and everything under `/api/*` except
  `/api/health` and `/api/auth/*` is `401 unauthenticated` without one.
  Unknown `/api` paths stay 404.
- Tests keep the `resolveOwner` seam (`x-test-owner` header) so the
  inventory/lending/cover suites did not change; `loginAs(userId)` creates
  a real session for auth-level tests. Playwright signs in through
  `POST /api/auth/test-login`, which only exists under `NODE_ENV=test`.
- New tables: `auth_identities`, `sessions`; new columns on `users`. See
  `docs/data-model.md`.
- The SPA must call the API on its own origin (relative `/api` URLs through
  the Vite proxy in dev, same process in Docker) for the cookie to travel;
  baking `VITE_API_URL` into the bundle makes requests cross-origin and
  unauthenticated (see "One origin" above for what a split would need).
- Without `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` the process boots (a fresh
  container has no secrets yet) but sign-in answers `503 auth_not_configured`.
