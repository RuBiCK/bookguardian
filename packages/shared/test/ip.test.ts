/**
 * The SSRF deny-list (BOOK-20): which addresses the server may be pointed at,
 * and what the cover-URL input schema does with the ones it may not.
 */
import { describe, expect, it } from 'vitest';
import {
  createBookInputSchema,
  hasBlockedHost,
  isBlockedAddress,
  isIpLiteral,
  parseIpAddress,
  updateBookInputSchema,
} from '../src';

describe('IP classification', () => {
  it('parses IPv4 and IPv6 literals, including bracketed and embedded forms', () => {
    expect(parseIpAddress('127.0.0.1')).toEqual({ family: 4, bytes: [127, 0, 0, 1] });
    expect(parseIpAddress('[::1]')?.bytes.at(-1)).toBe(1);
    expect(parseIpAddress('::ffff:127.0.0.1')?.bytes.slice(12)).toEqual([127, 0, 0, 1]);
    expect(isIpLiteral('covers.openlibrary.org')).toBe(false);
    expect(isIpLiteral('fe80::1')).toBe(true);
    for (const bad of ['256.0.0.1', '1.2.3', '12345::', 'g::1', '::1::2', 'fe80::1%eth0', '']) {
      expect(parseIpAddress(bad)).toBeNull();
    }
  });

  it('blocks loopback, link-local, RFC1918 and the rest of the non-public space', () => {
    for (const blocked of [
      '0.0.0.0',
      '10.1.2.3',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.255',
      '192.0.0.1',
      '192.168.1.1',
      '198.19.0.1',
      '224.0.0.1',
      '255.255.255.255',
      '::',
      '::1',
      'fd00::1',
      'fc00::1',
      'fe80::1',
      'ff02::1',
      '::ffff:127.0.0.1',
      '::ffff:169.254.169.254',
      '64:ff9b::7f00:1',
      '2002:c0a8:0101::1',
      '::7f00:1',
    ]) {
      expect(isBlockedAddress(blocked), blocked).toBe(true);
    }
    // Neighbours just outside the blocked ranges stay reachable.
    for (const allowed of [
      '1.1.1.1',
      '9.255.255.255',
      '11.0.0.1',
      '100.63.255.255',
      '128.0.0.1',
      '169.253.255.255',
      '172.15.255.255',
      '172.32.0.1',
      '192.0.1.1',
      '192.167.255.255',
      '198.17.255.255',
      '223.255.255.255',
      '2606:4700:4700::1111',
      '2002:0101:0101::1',
    ]) {
      expect(isBlockedAddress(allowed), allowed).toBe(false);
    }
    // Anything unrecognisable fails closed.
    expect(isBlockedAddress('not-an-address')).toBe(true);
  });

  it('reads the host out of a URL and lets hostnames through for DNS to judge', () => {
    expect(hasBlockedHost('https://covers.openlibrary.org/b/id/1-L.jpg')).toBe(false);
    expect(hasBlockedHost('https://93.184.216.34/c.jpg')).toBe(false);
    expect(hasBlockedHost('http://127.0.0.1:6379/')).toBe(true);
    expect(hasBlockedHost('http://[::1]:8080/x.png')).toBe(true);
    expect(hasBlockedHost('file:///etc/passwd')).toBe(true);
    expect(hasBlockedHost('nonsense')).toBe(true);
  });
});

describe('coverUrl input schema', () => {
  const blocked = [
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1:6379/',
    'http://[::1]:8080/x.png',
    'http://192.168.1.1/admin',
    'file:///etc/passwd',
    'gopher://127.0.0.1:11211/_x',
    'http://10.0.0.1/x.png',
    'http://[::ffff:127.0.0.1]/x.png',
    'ftp://covers.example.com/c.jpg',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'http://0x7f.1/x.png',
    'http://2130706433/x.png',
  ];

  it('rejects every scheme but http(s) and every non-public literal address', () => {
    for (const url of blocked) {
      expect(createBookInputSchema.safeParse({ title: 'X', coverUrl: url }).success, url).toBe(
        false,
      );
      expect(updateBookInputSchema.safeParse({ coverUrl: url }).success, url).toBe(false);
    }
  });

  it('still accepts the cover URLs real providers hand out', () => {
    for (const url of [
      'https://covers.openlibrary.org/b/id/15166231-L.jpg',
      'http://covers.openlibrary.org/b/isbn/9780441172719-L.jpg?default=false',
      'https://books.google.com/books/content?id=B1hSG45JCX4C&img=1&zoom=3',
      'https://pictures.example.com/cover.jpg',
      // A public address by number is unusual but not an attack.
      'https://93.184.216.34/cover.jpg',
    ]) {
      expect(createBookInputSchema.safeParse({ title: 'X', coverUrl: url }).success, url).toBe(
        true,
      );
    }
    expect(updateBookInputSchema.parse({ coverUrl: null })).toEqual({ coverUrl: null });
  });
});
