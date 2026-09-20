import { describe, expect, it } from 'vitest';
import {
  googleBooksCovers,
  normalizeGoogleImageUrl,
  openLibraryCovers,
  pickGoogleImage,
} from '../src/covers';
import { TransientError } from '../src/covers/download';
import {
  coverFetch,
  COVER_ID,
  GOOGLE_VOLUME,
  ISBN_GOOGLE_ONLY,
  ISBN_NO_COVER,
  ISBN_WITH_COVER,
  OL_COVERS,
} from './cover-fixtures';
import { GOOGLE_BOOKS, OPEN_LIBRARY } from './lookup-fixtures';

const ctx = (fetch = coverFetch()) => ({ fetch: fetch.fetch, timeoutMs: 1000, calls: fetch.calls });

describe('Google image URL normalisation', () => {
  it('forces https and strips the page-curl overlay wherever it sits', () => {
    expect(
      normalizeGoogleImageUrl(
        'http://books.google.com/books/content?id=X&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
      ),
    ).toBe(
      'https://books.google.com/books/content?id=X&printsec=frontcover&img=1&zoom=1&source=gbs_api',
    );
    expect(normalizeGoogleImageUrl('https://x.test/c?edge=curl')).toBe('https://x.test/c');
    expect(normalizeGoogleImageUrl('https://x.test/c?edge=curl&zoom=1')).toBe(
      'https://x.test/c?zoom=1',
    );
    expect(normalizeGoogleImageUrl('ftp://x.test/c')).toBeNull();
    expect(normalizeGoogleImageUrl('https://x.test/with space')).toBeNull();
  });

  it('prefers large → medium → thumbnail', () => {
    expect(
      pickGoogleImage({
        thumbnail: 'http://x.test/t',
        medium: 'http://x.test/m',
        large: 'http://x.test/l',
      }),
    ).toBe('https://x.test/l');
    expect(pickGoogleImage({ thumbnail: 'http://x.test/t', medium: 'http://x.test/m' })).toBe(
      'https://x.test/m',
    );
    expect(
      pickGoogleImage({ smallThumbnail: 'http://x.test/s', thumbnail: 'http://x.test/t' }),
    ).toBe('https://x.test/t');
    expect(pickGoogleImage(undefined)).toBeNull();
    expect(pickGoogleImage({ large: 'nope' })).toBeNull();
  });
});

describe('Open Library cover candidates', () => {
  const provider = openLibraryCovers({ baseUrl: OPEN_LIBRARY, coversUrl: OL_COVERS });

  it('lists the edition cover ids first, the rate-limited ISBN route last', async () => {
    expect(await provider.candidates(ISBN_WITH_COVER, ctx())).toEqual([
      `${OL_COVERS}/b/id/${COVER_ID}-L.jpg`,
      `${OL_COVERS}/b/isbn/${ISBN_WITH_COVER}-L.jpg?default=false`,
    ]);
  });

  it('falls back to the ISBN route when the edition has no cover ids or is unknown', async () => {
    expect(await provider.candidates(ISBN_GOOGLE_ONLY, ctx())).toEqual([
      `${OL_COVERS}/b/isbn/${ISBN_GOOGLE_ONLY}-L.jpg?default=false`,
    ]);
    expect(await provider.candidates(ISBN_NO_COVER, ctx())).toEqual([
      `${OL_COVERS}/b/isbn/${ISBN_NO_COVER}-L.jpg?default=false`,
    ]);
  });

  it('reports outages as transient', async () => {
    const fetch = coverFetch();
    fetch.route(async (url) => (url.pathname.endsWith('.json') ? { status: 503 } : undefined));
    await expect(provider.candidates(ISBN_WITH_COVER, ctx(fetch))).rejects.toBeInstanceOf(
      TransientError,
    );
  });
});

describe('Google Books cover candidates', () => {
  it('is skipped entirely without an API key', async () => {
    const c = ctx();
    expect(
      await googleBooksCovers({ baseUrl: GOOGLE_BOOKS }).candidates(ISBN_GOOGLE_ONLY, c),
    ).toEqual([]);
    expect(c.calls).toEqual([]);
  });

  it('asks the volume record for the large image and cleans the URLs', async () => {
    const c = ctx();
    const urls = await googleBooksCovers({ baseUrl: GOOGLE_BOOKS, apiKey: 'k' }).candidates(
      ISBN_GOOGLE_ONLY,
      c,
    );
    expect(urls).toEqual([
      `https://books.google.com/books/content?id=${GOOGLE_VOLUME}&printsec=frontcover&img=1&zoom=3&source=gbs_api`,
      `https://books.google.com/books/content?id=${GOOGLE_VOLUME}&printsec=frontcover&img=1&zoom=1&source=gbs_api`,
    ]);
    expect(c.calls.every((u) => u.includes('key=k'))).toBe(true);
    expect(
      await googleBooksCovers({ baseUrl: GOOGLE_BOOKS, apiKey: 'k' }).candidates(
        ISBN_NO_COVER,
        ctx(),
      ),
    ).toEqual([]);
  });
});
