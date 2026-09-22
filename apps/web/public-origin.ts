/**
 * The origin baked into the landing page's canonical / Open Graph / Twitter
 * tags at build time (index.html carries `%PUBLIC_ORIGIN%`; vite.config.ts
 * substitutes it). Build-time only — nothing in the running app depends on it.
 *
 * There is deliberately no default host. A fork that does not set
 * `PUBLIC_ORIGIN` gets relative URLs (`/`, `/og.png`) rather than tags
 * advertising somebody else's domain; a deployment that wants absolute URLs —
 * which is what a crawler or a chat unfurler needs, since neither runs our JS —
 * sets `PUBLIC_ORIGIN` to its own origin, the same value as the API's
 * `AUTH_BASE_URL` (Docker: `--build-arg PUBLIC_ORIGIN=…`).
 *
 * Lives outside `src/` on purpose: it is build configuration, not app code.
 */
import type { Plugin } from 'vite';

export const PUBLIC_ORIGIN_PLACEHOLDER = '%PUBLIC_ORIGIN%';

/** Normalise a configured origin: trimmed, no trailing slash, `''` when unset. */
export function resolvePublicOrigin(configured: string | undefined): string {
  return (configured ?? '').trim().replace(/\/+$/, '');
}

/** Fill `%PUBLIC_ORIGIN%` in an HTML document. An empty origin leaves relative URLs. */
export function applyPublicOrigin(html: string, origin: string): string {
  return html.replaceAll(PUBLIC_ORIGIN_PLACEHOLDER, origin);
}

/**
 * The Vite plugin `vite build` runs over index.html. Built here rather than
 * inline in vite.config.ts so the test suite can exercise the real thing
 * without importing the config (which drags esbuild into a jsdom environment).
 */
export function publicOriginPlugin(configured: string | undefined): Plugin {
  const origin = resolvePublicOrigin(configured);
  return {
    name: 'bookguardian-public-origin',
    transformIndexHtml: (html) => applyPublicOrigin(html, origin),
  };
}
