/**
 * Fixtures for the cover cascade: synthetic images (sharp renders them, so
 * no binary blobs live in the repo) and a fetch that answers the provider
 * URLs the resolver builds. Everything else 404s.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  createCoverResolver,
  createCoverService,
  createCoverStore,
  googleBooksCovers,
  openLibraryCovers,
  type CoverService,
} from '../src/covers';
import type { CoverServiceOptions } from '../src/covers/service';
import type { Repositories } from '../src/db/repositories';
import type { FetchLike } from '../src/lookup';
import { GOOGLE_BOOKS, OPEN_LIBRARY } from './lookup-fixtures';

export const OL_COVERS = 'https://covers.test';

/** ISBN whose Open Library edition lists a cover id. */
export const ISBN_WITH_COVER = '9780441172719';
/** ISBN Open Library knows without a cover; Google has one (with a key). */
export const ISBN_GOOGLE_ONLY = '9780441013593';
/** ISBN nobody has a cover for (Open Library answers its 1×1 GIF). */
export const ISBN_NO_COVER = '9780000000002';
/** ISBN whose cover download keeps failing with 503. */
export const ISBN_FLAKY = '9780000000019';

export const COVER_ID = 15166231;
export const GOOGLE_VOLUME = 'B1hSG45JCX4C';

const images = new Map<string, Promise<Buffer>>();
function memo(key: string, make: () => Promise<Buffer>): Promise<Buffer> {
  let p = images.get(key);
  if (!p) {
    p = make();
    images.set(key, p);
  }
  return p;
}

/** A plausible cover: 400×600 JPEG with a solid colour (`seed` varies the colour → different hash). */
export const coverJpeg = (seed = 0, width = 400, height = 600) =>
  memo(`jpeg:${seed}:${width}x${height}`, () =>
    sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: (seed * 37) % 256, g: (seed * 91) % 256, b: (seed * 53) % 256 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer(),
  );

/** A tall phone photo, EXIF-rotated (what a camera upload looks like). */
export const photoJpeg = () =>
  memo('photo', () =>
    sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#8844aa' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer(),
  );

/** Open Library's "no cover" reply. */
export const ONE_PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export const tinyPng = () =>
  memo('tiny', () =>
    sharp({ create: { width: 20, height: 30, channels: 3, background: '#000' } })
      .png()
      .toBuffer(),
  );

export type CoverRoute = (
  url: URL,
) => Promise<{ status: number; body?: unknown; type?: string } | undefined>;

export interface CoverFetch {
  fetch: FetchLike;
  calls: string[];
  route(fn: CoverRoute): void;
}

export function coverFetch(): CoverFetch {
  const calls: string[] = [];
  const routes: CoverRoute[] = [];

  const defaults: CoverRoute = async (url) => {
    const at = `${url.origin}${url.pathname}`;
    // Open Library edition records.
    if (at === `${OPEN_LIBRARY}/isbn/${ISBN_WITH_COVER}.json`)
      return { status: 200, body: { title: 'Dune', covers: [COVER_ID] } };
    if (at === `${OPEN_LIBRARY}/isbn/${ISBN_GOOGLE_ONLY}.json`)
      return { status: 200, body: { title: 'Dune', covers: [-1] } };
    if (at === `${OPEN_LIBRARY}/isbn/${ISBN_FLAKY}.json`)
      return { status: 200, body: { title: 'Flaky', covers: [999] } };
    if (at.startsWith(`${OPEN_LIBRARY}/isbn/`)) return { status: 404, body: { error: 'notfound' } };
    // Open Library cover images.
    if (at === `${OL_COVERS}/b/id/${COVER_ID}-L.jpg`)
      return { status: 200, body: await coverJpeg(1), type: 'image/jpeg' };
    if (at === `${OL_COVERS}/b/id/999-L.jpg`) return { status: 503, body: 'try later' };
    if (at.startsWith(`${OL_COVERS}/b/isbn/`)) {
      // `?default=false` → 404 when unknown; some ISBNs still get the 1×1 GIF.
      if (url.pathname.includes(ISBN_NO_COVER))
        return { status: 200, body: ONE_PIXEL_GIF, type: 'image/gif' };
      return { status: 404, body: 'not found' };
    }
    // Google Books (only with a key; the resolver never calls it otherwise).
    if (at === `${GOOGLE_BOOKS}/volumes`) {
      const q = url.searchParams.get('q');
      if (q === `isbn:${ISBN_GOOGLE_ONLY}`)
        return {
          status: 200,
          body: {
            items: [
              {
                id: GOOGLE_VOLUME,
                volumeInfo: {
                  imageLinks: {
                    thumbnail: `http://books.google.com/books/content?id=${GOOGLE_VOLUME}&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api`,
                  },
                },
              },
            ],
          },
        };
      return { status: 200, body: { totalItems: 0 } };
    }
    if (at === `${GOOGLE_BOOKS}/volumes/${GOOGLE_VOLUME}`)
      return {
        status: 200,
        body: {
          id: GOOGLE_VOLUME,
          volumeInfo: {
            imageLinks: {
              thumbnail: `http://books.google.com/books/content?id=${GOOGLE_VOLUME}&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api`,
              large: `http://books.google.com/books/content?id=${GOOGLE_VOLUME}&printsec=frontcover&img=1&zoom=3&edge=curl&source=gbs_api`,
            },
          },
        },
      };
    if (at === 'https://books.google.com/books/content') {
      if (url.searchParams.get('edge') === 'curl') return { status: 500, body: 'unexpected' };
      const zoom = url.searchParams.get('zoom');
      return {
        status: 200,
        body: await coverJpeg(
          zoom === '3' ? 3 : 2,
          zoom === '3' ? 600 : 128,
          zoom === '3' ? 900 : 192,
        ),
        type: 'image/jpeg',
      };
    }
    // Pasted / arbitrary URLs used by tests.
    if (at === 'https://pictures.test/cover.jpg')
      return { status: 200, body: await coverJpeg(7), type: 'image/jpeg' };
    if (at === 'https://pictures.test/page.html')
      return { status: 200, body: '<html>nope</html>', type: 'text/html' };
    if (at === 'https://pictures.test/tiny.png')
      return { status: 200, body: await tinyPng(), type: 'image/png' };
    return undefined;
  };

  const respond = (hit: { status: number; body?: unknown; type?: string }) => {
    const { status, body, type } = hit;
    if (Buffer.isBuffer(body)) {
      return new Response(new Uint8Array(body), {
        status,
        headers: { 'content-type': type ?? 'application/octet-stream' },
      });
    }
    if (typeof body === 'string') {
      return new Response(body, { status, headers: { 'content-type': type ?? 'text/plain' } });
    }
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };

  return {
    calls,
    route: (fn) => routes.unshift(fn),
    fetch: async (input) => {
      const url = new URL(input);
      calls.push(url.toString());
      for (const route of [...routes, defaults]) {
        const hit = await route(url);
        if (hit) return respond(hit);
      }
      return respond({ status: 404, body: { error: 'unrouted' } });
    },
  };
}

export interface FixtureCoversOptions extends Partial<
  Pick<
    CoverServiceOptions,
    'missMs' | 'gcSharedAfterMs' | 'gcGraceMs' | 'now' | 'retry' | 'minIntervalMs'
  >
> {
  fetch?: CoverFetch;
  /** Enables the Google Books step. */
  apiKey?: string;
}

export interface FixtureCovers {
  service: CoverService;
  fetch: CoverFetch;
  log: string[];
  dir: string;
  cleanup(this: void): void;
}

/** A cover service over fixtures, files in a temp dir, no pacing or long backoffs. */
export function fixtureCovers(
  repos: Repositories,
  overrides: FixtureCoversOptions = {},
): FixtureCovers {
  const fetch = overrides.fetch ?? coverFetch();
  const log: string[] = [];
  const dir = mkdtempSync(join(tmpdir(), 'bookguardian-covers-'));
  const timeoutMs = 1000;
  const service = createCoverService({
    repos,
    store: createCoverStore(dir),
    resolve: createCoverResolver({
      providers: [
        openLibraryCovers({ baseUrl: OPEN_LIBRARY, coversUrl: OL_COVERS }),
        googleBooksCovers({ baseUrl: GOOGLE_BOOKS, apiKey: overrides.apiKey }),
      ],
      fetch: fetch.fetch,
      timeoutMs,
      log: (m) => log.push(m),
    }),
    fetch: fetch.fetch,
    timeoutMs,
    minIntervalMs: overrides.minIntervalMs ?? 0,
    retry: overrides.retry ?? { attempts: 3, baseDelayMs: 1 },
    gcIntervalMs: 0,
    gcGraceMs: overrides.gcGraceMs ?? 0,
    missMs: overrides.missMs,
    gcSharedAfterMs: overrides.gcSharedAfterMs,
    now: overrides.now,
    log: (m) => log.push(m),
  });
  return {
    service,
    fetch,
    log,
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
