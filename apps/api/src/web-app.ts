/**
 * Serve the built SPA (`apps/web/dist`) from the API process.
 *
 * Real files win (index.html at `/`, hashed assets, icons, manifest, service
 * worker); any other non-API GET is a client-side route and gets the app shell,
 * so deep links and PWA launches work. `/api/*` is never touched here — its
 * 404s keep the JSON error envelope.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';
import type { AppEnv } from './app-env';

/** Vite emits content-hashed file names under `assets/`; they never change. */
const IMMUTABLE = 'public, max-age=31536000, immutable';
/** Everything else (index.html, sw.js, manifest, icons) must always revalidate. */
const REVALIDATE = 'no-cache';

export function isApiPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/');
}

function isHashedAsset(path: string): boolean {
  return path.startsWith('/assets/');
}

export function mountWebApp(app: Hono<AppEnv>, root: string): void {
  if (!existsSync(join(root, 'index.html'))) {
    throw new Error(`WEB_DIST=${root} does not contain index.html; run \`pnpm build\` first`);
  }
  const files = serveStatic({ root });
  const shell = serveStatic({ root, path: 'index.html' });

  // 1. A real file under dist. Cache headers must be set before serveStatic
  //    builds the response.
  app.get('/*', (c, next) => {
    if (isApiPath(c.req.path)) return next();
    c.header('Cache-Control', isHashedAsset(c.req.path) ? IMMUTABLE : REVALIDATE);
    return files(c, next);
  });

  // 2. Not a file: a client-side route gets the shell. A missing hashed asset is
  //    a real 404 (never the shell, never cached).
  app.get('/*', (c, next) => {
    if (isApiPath(c.req.path)) return next();
    if (isHashedAsset(c.req.path)) {
      c.header('Cache-Control', undefined);
      return next();
    }
    return shell(c, next);
  });
}
