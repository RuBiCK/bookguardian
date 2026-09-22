# Security policy

Bookguardian is a self-hosted personal library manager: one small container that
holds someone's book collection, their Google identity and their session
cookies. Anything that leaks another user's data, bypasses sign-in or lets an
attacker reach the host is worth reporting.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting instead:
[**Report a vulnerability**](https://github.com/RuBiCK/bookguardian/security/advisories/new)
(repository → **Security** → **Advisories** → _Report a vulnerability_). The
report stays private between you and the maintainer until a fix is published.

If that form is unavailable to you, open a public issue that says only "security
report, need a private channel" — no details — and the maintainer will open a
private advisory and invite you to it.

What helps, roughly in order of usefulness:

- the version or commit you tested (`docker compose` build, tag, or commit SHA),
- what an attacker gains, not just what looks wrong,
- the smallest reproduction you have — a `curl`, a request sequence, a diff,
- whether it needs an authenticated session, and whose.

## What to expect

|                                                               |                                                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Acknowledgement                                               | within 7 days                                                                                 |
| First assessment (accepted / not a vulnerability / need more) | within 14 days                                                                                |
| Fix for an accepted report                                    | as fast as a hobby project honestly can; you will get progress updates                        |
| Credit                                                        | your name or handle in the advisory and release notes, unless you would rather stay anonymous |

This is a personal project with no on-call rotation, so "within 7 days" is a
commitment to answer, not to have a patch ready.

## Scope

In scope — the code in this repository and the image it builds:

- authentication and session handling (`apps/api/src/auth/*`, the Google OIDC
  flow, session cookies, `AUTH_ALLOWED_EMAILS`),
- data isolation between accounts — every aggregate carries `owner_id`, and
  reaching another owner's library, shelf, book or lending is a vulnerability,
- the REST API: injection, path traversal (cover files under `/data/covers`),
  SSRF through the metadata/cover providers, unvalidated input reaching the
  database or the filesystem,
- the web app: XSS, cross-origin weaknesses, anything that exposes the session
  cookie,
- the container: privilege escalation, writable paths outside `/data`, secrets
  baked into the image,
- the supply chain: a way to land a dependency that bypasses
  `minimumReleaseAge` or `scripts/check-release-age.mjs`.

Out of scope:

- missing hardening on a deployment you control — no HTTPS in front of the
  container, a publicly reachable instance with `AUTH_ALLOWED_EMAILS` unset, a
  world-readable `./data` directory, secrets committed to your own fork,
- vulnerabilities in third-party services (Open Library, Google Books, Google
  sign-in) or in a dependency with no exploitable path through this code —
  report those upstream; tell us if our usage is what makes it exploitable,
- automated scanner output with no demonstrated impact, missing security headers
  with no attack behind them, best-practice suggestions,
- denial of service by flooding a single-user self-hosted app,
- social engineering of the maintainer.

## Supported versions

Pre-1.0 and single-branch: fixes land on `main`, and there are no backports.
Self-hosters should track `main` (or the latest image built from it).

| Version               | Supported   |
| --------------------- | ----------- |
| `main` / latest image | yes         |
| anything older        | no — update |

## Safe harbour

Test against your own instance. If you find something on someone else's, stop
and report it. We will not pursue or support action against anyone who acts in
good faith under this policy: no accessing or modifying data that is not yours,
no denial of service, no spam, no social engineering, and give us a reasonable
window to fix the issue before publishing.
