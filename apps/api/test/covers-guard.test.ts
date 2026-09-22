/**
 * The SSRF guard and the redirect walk in front of every cover download
 * (BOOK-20): what the server refuses to fetch, and that refusing is a
 * permanent answer rather than four retries with backoff.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  BlockedUrlError,
  createUrlGuard,
  dnsAddressLookup,
  downloadImage,
  TransientError,
  type AddressLookup,
} from '../src/covers';
import {
  coverFetch,
  coverJpeg,
  fixtureAddressLookup,
  fixtureUrlGuard,
  METADATA_URL,
  PRIVATE_HOST,
  REDIRECT_TO_COVER,
  REDIRECT_TO_METADATA,
} from './cover-fixtures';

const ctx = (fetch: ReturnType<typeof coverFetch>) => ({
  fetch: fetch.fetch,
  guard: fixtureUrlGuard,
  timeoutMs: 1000,
});

describe('cover URL guard', () => {
  it('refuses every scheme but http(s), and every non-public literal address', async () => {
    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:6379/',
      'http://[::1]:8080/x.png',
      'http://192.168.1.1/admin',
      'file:///etc/passwd',
      'gopher://127.0.0.1:11211/_x',
      'http://[::ffff:169.254.169.254]/',
      'not a url',
    ]) {
      await expect(fixtureUrlGuard(url), url).rejects.toBeInstanceOf(BlockedUrlError);
    }
    await expect(fixtureUrlGuard('https://covers.test/b/id/1-L.jpg')).resolves.toBeUndefined();
    await expect(fixtureUrlGuard('https://93.184.216.34/c.jpg')).resolves.toBeUndefined();
  });

  it('rejects a hostname that resolves to a private address, and any address in the answer', async () => {
    await expect(fixtureUrlGuard(`https://${PRIVATE_HOST}/cover.jpg`)).rejects.toThrow(
      /resolves to 127\.0\.0\.1/,
    );
    // A name with one public and one private record is still a way in.
    await expect(fixtureUrlGuard('https://mixed.test/cover.jpg')).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });

  it('treats a name that does not resolve as transient, not as policy', async () => {
    await expect(fixtureUrlGuard('https://nxdomain.test/c.jpg')).rejects.toBeInstanceOf(
      TransientError,
    );
    const failing: AddressLookup = () => Promise.reject(new Error('EAI_AGAIN'));
    await expect(
      createUrlGuard({ lookup: failing })('https://x.test/c.jpg'),
    ).rejects.toBeInstanceOf(TransientError);
  });

  it('exempts the origins the operator configured, and nothing next to them', async () => {
    const guard = createUrlGuard({
      lookup: fixtureAddressLookup,
      allow: ['http://localhost:3101', 'https://openlibrary.test/'],
    });
    await expect(guard('http://localhost:3101/b/id/1-L.jpg')).resolves.toBeUndefined();
    await expect(
      guard('https://openlibrary.test/isbn/9780441172719.json'),
    ).resolves.toBeUndefined();
    // A neighbouring port, the same host by address, and an exempt-looking
    // scheme are all still somebody else.
    for (const url of [
      'http://localhost:3102/b/id/1-L.jpg',
      'http://127.0.0.1:3101/b/id/1-L.jpg',
      'https://localhost:3101/b/id/1-L.jpg',
      'file://localhost:3101/etc/passwd',
    ]) {
      await expect(guard(url), url).rejects.toBeInstanceOf(BlockedUrlError);
    }
  });

  it('resolves through the real resolver by default', async () => {
    // `localhost` comes from the hosts file, so this needs no network — and
    // it is what production would have blocked.
    await expect(dnsAddressLookup('localhost')).resolves.not.toHaveLength(0);
    await expect(createUrlGuard()('http://localhost/cover.jpg')).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });

  it('asks DNS only for names, never for a literal address', async () => {
    const lookup = vi.fn(fixtureAddressLookup);
    const guard = createUrlGuard({ lookup });
    await expect(guard('http://127.0.0.1/x.png')).rejects.toBeInstanceOf(BlockedUrlError);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('downloadImage', () => {
  it('never issues the request for a blocked URL', async () => {
    const fetch = coverFetch();
    await expect(downloadImage(METADATA_URL, ctx(fetch))).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(
      downloadImage(`https://${PRIVATE_HOST}/cover.jpg`, ctx(fetch)),
    ).rejects.toBeInstanceOf(BlockedUrlError);
    expect(fetch.calls).toEqual([]);
  });

  it('reports a refused connection as transient, once the guard has allowed the URL', async () => {
    const fetch = coverFetch();
    fetch.route(async (url) => {
      if (url.pathname === '/down.jpg') throw new Error('ECONNREFUSED');
      return undefined;
    });
    await expect(
      downloadImage('https://pictures.test/down.jpg', ctx(fetch)),
    ).rejects.toBeInstanceOf(TransientError);
  });

  it('stops a redirect chain that turns towards a blocked address', async () => {
    const fetch = coverFetch();
    await expect(downloadImage(REDIRECT_TO_METADATA, ctx(fetch))).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
    expect(fetch.calls).toEqual([REDIRECT_TO_METADATA]);
  });

  it('follows a redirect chain that stays public, resolving relative hops', async () => {
    const fetch = coverFetch();
    const download = await downloadImage(REDIRECT_TO_COVER, ctx(fetch));
    expect(download.ok).toBe(true);
    expect(download.ok && download.body.equals(await coverJpeg(1))).toBe(true);
    expect(fetch.calls).toEqual([
      REDIRECT_TO_COVER,
      'https://pictures.test/hop-2.jpg',
      'https://covers.test/b/id/15166231-L.jpg',
    ]);
  });

  it('gives up on an endless chain instead of looping', async () => {
    const fetch = coverFetch();
    fetch.route(async (url) =>
      url.pathname === '/loop.jpg'
        ? { status: 302, headers: { location: '/loop.jpg' } }
        : undefined,
    );
    const download = await downloadImage('https://pictures.test/loop.jpg', {
      ...ctx(fetch),
      maxRedirects: 2,
    });
    expect(download).toEqual({ ok: false, reason: 'more than 2 redirects' });
    expect(fetch.calls).toHaveLength(3);
  });

  it('rejects a redirect with no location and one that is not a URL', async () => {
    const fetch = coverFetch();
    fetch.route(async (url) => {
      if (url.pathname === '/headless.jpg') return { status: 301 };
      if (url.pathname === '/junk.jpg')
        return { status: 302, headers: { location: 'http://[oops' } };
      return undefined;
    });
    expect(await downloadImage('https://pictures.test/headless.jpg', ctx(fetch))).toEqual({
      ok: false,
      reason: 'HTTP 301 without a location',
    });
    expect(await downloadImage('https://pictures.test/junk.jpg', ctx(fetch))).toEqual({
      ok: false,
      reason: 'unusable redirect target (http://[oops)',
    });
  });
});
