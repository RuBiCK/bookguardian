import { describe, expect, it } from 'vitest';
import {
  createCoverResolver,
  googleBooksCovers,
  openLibraryCovers,
  TransientError,
} from '../src/covers';
import {
  coverFetch,
  ISBN_FLAKY,
  ISBN_GOOGLE_ONLY,
  ISBN_NO_COVER,
  ISBN_WITH_COVER,
  fixtureUrlGuard,
  OL_COVERS,
} from './cover-fixtures';
import { GOOGLE_BOOKS, OPEN_LIBRARY } from './lookup-fixtures';

function resolver(options: { apiKey?: string; fetch?: ReturnType<typeof coverFetch> } = {}) {
  const fetch = options.fetch ?? coverFetch();
  const log: string[] = [];
  const resolve = createCoverResolver({
    providers: [
      openLibraryCovers({ baseUrl: OPEN_LIBRARY, coversUrl: OL_COVERS }),
      googleBooksCovers({ baseUrl: GOOGLE_BOOKS, apiKey: options.apiKey }),
    ],
    fetch: fetch.fetch,
    guard: fixtureUrlGuard,
    timeoutMs: 1000,
    log: (m) => log.push(m),
  });
  return { resolve, fetch, log };
}

describe('cover cascade', () => {
  it('takes the Open Library cover id when the edition has one', async () => {
    const { resolve, fetch } = resolver({ apiKey: 'k' });
    const found = await resolve(ISBN_WITH_COVER);
    expect(found).toMatchObject({
      source: 'open_library',
      url: `${OL_COVERS}/b/id/15166231-L.jpg`,
    });
    expect(found?.cover).toMatchObject({ width: 400, height: 600 });
    expect(fetch.calls.some((u) => u.startsWith(GOOGLE_BOOKS))).toBe(false);
  });

  it('falls through to Google Books only with a key, taking the largest clean image', async () => {
    const without = resolver();
    expect(await without.resolve(ISBN_GOOGLE_ONLY)).toBeNull();
    expect(without.fetch.calls.some((u) => u.startsWith(GOOGLE_BOOKS))).toBe(false);

    const withKey = resolver({ apiKey: 'k' });
    const found = await withKey.resolve(ISBN_GOOGLE_ONLY);
    expect(found).toMatchObject({ source: 'google_books' });
    expect(found?.url).toContain('zoom=3');
    expect(found?.url).not.toContain('edge=curl');
    expect(found?.cover).toMatchObject({ width: 400, height: 600 });
  });

  it('discards the 1×1 GIF, HTML and tiny images as "no cover"', async () => {
    const { resolve, log } = resolver({ apiKey: 'k' });
    expect(await resolve(ISBN_NO_COVER)).toBeNull();
    expect(log.join('\n')).toMatch(/not a usable cover/);
  });

  it('does not trust a miss when a provider was down', async () => {
    const { resolve } = resolver();
    await expect(resolve(ISBN_FLAKY)).rejects.toBeInstanceOf(TransientError);

    // Open Library down entirely, Google (with key) has the cover → still found.
    const fetch = coverFetch();
    fetch.route(async (url) =>
      url.origin === new URL(OPEN_LIBRARY).origin ? { status: 500 } : undefined,
    );
    const { resolve: withGoogle } = resolver({ apiKey: 'k', fetch });
    expect(await withGoogle(ISBN_GOOGLE_ONLY)).toMatchObject({ source: 'google_books' });

    // Everyone down → transient.
    const down = coverFetch();
    down.route(async () => ({ status: 503 }));
    await expect(resolver({ apiKey: 'k', fetch: down }).resolve(ISBN_WITH_COVER)).rejects.toThrow(
      /HTTP 503/,
    );
  });
});
