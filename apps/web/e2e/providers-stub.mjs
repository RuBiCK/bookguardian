#!/usr/bin/env node
/**
 * Stand-in for Open Library during e2e: the API under test is pointed at
 * this server (OPEN_LIBRARY_URL / OPEN_LIBRARY_COVERS_URL), so the cover
 * cascade runs for real — edition record → cover id → image download →
 * WebP → served back by the API — without the network.
 *
 *   GET  /isbn/<isbn13>.json           edition with `covers` (404 when unknown)
 *   GET  /b/id/<id>-L.jpg              a fixture PNG
 *   GET  /b/isbn/<isbn13>-L.jpg        always 404 (the rate-limited route)
 *   POST /__stub/enable/<isbn13>/<id>  make an ISBN known from now on
 *   GET  /__stub/health
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 3101);
const here = dirname(fileURLToPath(import.meta.url));
const covers = {
  1: readFileSync(join(here, 'fixtures', 'cover-dune.png')),
  2: readFileSync(join(here, 'fixtures', 'cover-emma.png')),
  3: readFileSync(join(here, 'fixtures', 'cover-neuromancer.png')),
};
/** ISBN-13 → cover id. Known from the start; tests enable more at runtime. */
const editions = new Map([
  ['9780441013593', 1],
  ['9780141439587', 2],
]);

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const json = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  let m;
  if (url.pathname === '/__stub/health') return json(200, { ok: true });
  if (req.method === 'POST' && (m = /^\/__stub\/enable\/(\d{13})\/(\d+)$/.exec(url.pathname))) {
    editions.set(m[1], Number(m[2]));
    return json(200, { isbn13: m[1], cover: Number(m[2]) });
  }
  if ((m = /^\/isbn\/(\d{13})\.json$/.exec(url.pathname))) {
    const id = editions.get(m[1]);
    return id
      ? json(200, { key: `/books/OL${m[1]}M`, title: `Book ${m[1]}`, covers: [id] })
      : json(404, { error: 'notfound' });
  }
  if ((m = /^\/b\/id\/(\d+)-L\.jpg$/.exec(url.pathname))) {
    const png = covers[m[1]];
    if (!png) return json(404, { error: 'notfound' });
    res.writeHead(200, { 'content-type': 'image/png', 'content-length': png.length });
    return res.end(png);
  }
  if (url.pathname.startsWith('/b/isbn/')) return json(404, { error: 'notfound' });
  // Anything else the metadata lookup may ask for (search, works, authors).
  if (url.pathname === '/search.json') return json(200, { docs: [] });
  return json(404, { error: 'notfound' });
}).listen(PORT, () => {
  console.log(`[providers-stub] listening on http://localhost:${PORT}`);
});
