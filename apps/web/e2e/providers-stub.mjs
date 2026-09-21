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
 *   GET  /search.json?title=&author=   the Foundation novels for a query naming them, else no docs
 *   GET  /volumes                      Google Books stand-in: never any items
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
  // add-online.spec.ts: what the search below answers with, so the cascade finds their covers.
  ['9780553293357', 3],
  ['9780553293371', 2],
]);

/** Open Library search docs (work + best edition) for the "Foundation" query. */
const FOUNDATION_DOCS = [
  {
    key: '/works/OL46125W',
    title: 'Foundation',
    author_name: ['Isaac Asimov'],
    first_publish_year: 1951,
    cover_i: 3,
    subject: ['Science fiction', 'Psychohistory'],
    editions: {
      docs: [
        {
          key: '/books/OL7825195M',
          title: 'Foundation',
          cover_i: 3,
          language: ['eng'],
          publisher: ['Bantam Spectra'],
          publish_date: ['1991'],
          isbn: ['9780553293357', '0553293354'],
          number_of_pages: 296,
        },
      ],
    },
  },
  {
    key: '/works/OL46127W',
    title: 'Foundation and Empire',
    author_name: ['Isaac Asimov'],
    first_publish_year: 1952,
    cover_i: 2,
    subject: ['Science fiction'],
    editions: {
      docs: [
        {
          key: '/books/OL7825196M',
          title: 'Foundation and Empire',
          cover_i: 2,
          language: ['eng'],
          publisher: ['Bantam Spectra'],
          publish_date: ['1991'],
          isbn: ['9780553293371', '0553293370'],
          number_of_pages: 320,
        },
      ],
    },
  },
];

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
  // Metadata search: the add-book form's "Search online" (title/author) and the scan tab (q).
  if (url.pathname === '/search.json') {
    const asked = ['q', 'title', 'author']
      .map((p) => url.searchParams.get(p) ?? '')
      .join(' ')
      .toLowerCase();
    const docs = asked.includes('foundation') || asked.includes('asimov') ? FOUNDATION_DOCS : [];
    return json(200, { numFound: docs.length, docs });
  }
  // Google Books stand-in: reachable, never knows anything.
  if (url.pathname === '/volumes') return json(200, { kind: 'books#volumes', totalItems: 0 });
  // Anything else the metadata lookup may ask for (works, authors).
  return json(404, { error: 'notfound' });
}).listen(PORT, () => {
  console.log(`[providers-stub] listening on http://localhost:${PORT}`);
});
