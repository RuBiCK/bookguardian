# Changelog

All notable changes to Book Guardian will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-13 — Production Readiness

### Added

#### Security Hardening
- Zod input validation schemas for all API routes (books, libraries, shelves, lending, admin) in `src/lib/validation.ts`.
- In-memory rate limiting to all API endpoints (`src/lib/rate-limit.ts`) with tiered limits: 30 req/min default for reads, 10-20 req/min for writes, and 5 req/min for export.
- Security headers via Next.js config: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` (DENY), `X-Content-Type-Options` (nosniff), `Referrer-Policy`, and `Permissions-Policy` (camera self-allowed).
- Session security configuration: `maxAge: 30 days` and `updateAge: 24 hours` in NextAuth config.
- Admin self-promotion guard preventing admins from modifying their own role.
- Environment variable validation module (`src/lib/env.ts`) for runtime config checks.

#### AI Performance Optimization
- Vision API `detail: 'low'` parameter for single book analysis, yielding approximately 96% token savings.
- Vision API `detail: 'high'` for shelf analysis where multi-book recognition requires full detail.
- Server-side image processing with sharp: resize, WebP conversion, and quality control.
- Client-side canvas compression for file uploads (max 800px width, JPEG 0.8 quality).
- Image size validation before AI calls (5MB limit for single books, 10MB for shelves).
- Configurable `maxWidth` option for image preprocessing (768px for single book, 2048px for shelf).

#### Accessibility
- Skip-to-content link in layout with `sr-only`/`focus-visible` pattern.
- `id="main-content"` target for skip link navigation.
- `aria-label="Main navigation"` on the nav element.
- `aria-expanded` and `aria-label` attributes on the user menu button.
- `role="status"`, `aria-live="polite"`, and `aria-atomic="true"` on the Toast component.
- `aria-label="Dismiss notification"` on the toast close button.

#### Database
- `@@index([shelfId])` on Book model for shelf-based query performance.
- `@@index([readStatus])` on Book model for read status filtering performance.

#### Testing
- Vitest test framework with jsdom environment.
- `@testing-library/react` and `@testing-library/jest-dom` for component testing.
- Functional tests for validation schemas, rate limiter, image processor, and env validation.
- Smoke tests for module imports, configuration files, and security settings.

#### Dependencies
- `sharp` for server-side image processing.
- `zod` for input validation.
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, and `@vitejs/plugin-react` as dev dependencies.

### Changed

#### AI Performance Optimization
- Default image format from JPEG to WebP for 25-35% smaller payloads.

#### Configuration & Content
- Replaced hardcoded PostgreSQL credentials in `docker-compose.yml` with environment variable substitution (`${POSTGRES_USER:-}` pattern).

### Fixed

#### Configuration & Content
- Placeholder email addresses in privacy policy (now `privacy@bookguardian.app`) and terms of service (now `legal@bookguardian.app`).

### Removed

#### Configuration & Content
- Non-existent screenshots section from the PWA manifest.
- Developer notes from legal pages.

## [0.1.0] - Initial Release

### Added
- Book management with library and shelf organization.
- AI-powered book recognition via OpenAI Vision API (camera and file upload).
- User authentication with NextAuth.
- Lending tracker for borrowed and lent books.
- Admin dashboard with user management.
- PWA support with offline capabilities.
- Privacy policy and terms of service pages.
