/**
 * The API can serve the built SPA (`WEB_DIST`) so one container is one origin.
 * A fake `dist/` stands in for `apps/web/dist`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isApiPath, mountWebApp } from '../src/web-app';
import { createTestApp, type ErrorBody, type TestApp } from './app';

const INDEX_HTML = '<!doctype html><html><body><div id="root"></div></body></html>';
const APP_JS = 'console.log("bookguardian")';

function fakeDist(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bookguardian-dist-'));
  mkdirSync(join(dir, 'assets'));
  mkdirSync(join(dir, 'icons'));
  writeFileSync(join(dir, 'index.html'), INDEX_HTML);
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), APP_JS);
  writeFileSync(join(dir, 'icons', 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  writeFileSync(join(dir, 'manifest.webmanifest'), '{"name":"Bookguardian"}');
  writeFileSync(join(dir, 'sw.js'), 'self.skipWaiting()');
  return dir;
}

describe('serving the web app from the API', () => {
  let dist: string;
  let served: TestApp;
  let app: TestApp['app'];

  beforeAll(async () => {
    dist = fakeDist();
    served = await createTestApp({ webDist: dist });
    app = served.app;
  });
  afterAll(async () => {
    await served.cleanup();
    rmSync(dist, { recursive: true, force: true });
  });

  it('serves index.html at the root', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(await res.text()).toBe(INDEX_HTML);
  });

  it('serves hashed assets as immutable with the right content type', async () => {
    const res = await app.request('/assets/index-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/javascript/);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(await res.text()).toBe(APP_JS);
  });

  it('serves PWA files with revalidation so updates are picked up', async () => {
    for (const [path, type] of [
      ['/sw.js', /javascript/],
      ['/manifest.webmanifest', /manifest\+json/],
      ['/icons/icon.svg', /image\/svg\+xml/],
    ] as const) {
      const res = await app.request(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('content-type'), path).toMatch(type);
      expect(res.headers.get('cache-control'), path).toBe('no-cache');
    }
  });

  it('falls back to index.html for client-side routes (deep links)', async () => {
    for (const path of ['/scan', '/books/0193c9a0-1234-7000-8000-000000000000', '/libraries/x']) {
      const res = await app.request(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('content-type'), path).toMatch(/text\/html/);
      expect(res.headers.get('cache-control'), path).toBe('no-cache');
      expect(await res.text(), path).toBe(INDEX_HTML);
    }
  });

  it('answers HEAD for the shell and for files', async () => {
    const res = await app.request('/shelves/abc', { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toBe('');
  });

  it('returns a JSON 404 for a missing hashed asset instead of the shell', async () => {
    const res = await app.request('/assets/index-stale.js');
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBeNull();
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('not_found');
  });

  it('never shadows the API: unknown /api routes keep the JSON envelope', async () => {
    for (const path of ['/api/nope', '/api/books/not-a-uuid/extra', '/api']) {
      const res = await app.request(path);
      expect(res.status, path).toBe(404);
      expect(res.headers.get('content-type'), path).toMatch(/application\/json/);
      const body = (await res.json()) as ErrorBody;
      expect(body.error.code, path).toBe('not_found');
    }
  });

  it('keeps API routes working next to the SPA', async () => {
    const res = await app.request('/api/health?shallow=true');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe('ok');
  });

  it('does not answer non-GET requests with the shell', async () => {
    const res = await app.request('/scan', { method: 'POST' });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('not_found');
  });

  it('rejects path traversal out of the dist directory', async () => {
    const res = await app.request('/assets/../../package.json');
    // Hono normalises the URL before routing; either way nothing outside dist leaks.
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(INDEX_HTML);
    const raw = await app.request('/assets/%2e%2e/%2e%2e/package.json');
    expect(await raw.text()).toBe(INDEX_HTML);
  });

  it('is off by default: without WEB_DIST the root is a JSON 404', async () => {
    const bare = await createTestApp();
    try {
      const res = await bare.app.request('/');
      expect(res.status).toBe(404);
      const body = (await res.json()) as ErrorBody;
      expect(body.error.code).toBe('not_found');
    } finally {
      await bare.cleanup();
    }
  });

  it('fails fast when WEB_DIST has no index.html', () => {
    const empty = mkdtempSync(join(tmpdir(), 'bookguardian-empty-'));
    try {
      expect(() => mountWebApp(new Hono(), empty)).toThrow(/index\.html/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('recognises API paths exactly', () => {
    expect(isApiPath('/api')).toBe(true);
    expect(isApiPath('/api/books')).toBe(true);
    expect(isApiPath('/apiary')).toBe(false);
    expect(isApiPath('/')).toBe(false);
  });
});
