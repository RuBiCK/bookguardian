/**
 * Which IP addresses the server may be asked to fetch on a user's behalf.
 *
 * A cover URL comes from the client, and the server fetches it: without this
 * an authenticated user could point it at the cloud metadata endpoint, at a
 * service on loopback, or at any box on a self-hosted LAN (BOOK-20). The
 * policy is a deny-list of the ranges that are not "somewhere on the public
 * internet" — an allow-list of provider hosts would be tighter, but pasting
 * an arbitrary cover URL is a real flow in the add-book form, so the URL has
 * to stay open-ended.
 *
 * Only classification lives here, so both the shared input schema (literal
 * addresses, rejected with a 422) and the API's download guard (the same
 * check against what DNS actually answered) apply one rule.
 */

export interface IpAddress {
  family: 4 | 6;
  /** 4 bytes for IPv4, 16 for IPv6. */
  bytes: number[];
}

/** Ranges an IPv4 address must not fall in, as `address/prefix`. */
const BLOCKED_V4 = [
  '0.0.0.0/8', // "this network"
  '10.0.0.0/8', // RFC1918
  '100.64.0.0/10', // carrier NAT
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local, incl. the cloud metadata endpoint
  '172.16.0.0/12', // RFC1918
  '192.0.0.0/24', // IETF protocol assignments
  '192.168.0.0/16', // RFC1918
  '198.18.0.0/15', // benchmarking
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reserved, incl. 255.255.255.255
] as const;

/** Ranges an IPv6 address must not fall in. Embedded IPv4 is unwrapped first. */
const BLOCKED_V6 = [
  '::/128', // unspecified
  '::1/128', // loopback
  '100::/64', // discard-only
  'fc00::/7', // unique local, incl. fd00::/8
  'fe80::/10', // link-local
  'ff00::/8', // multicast
] as const;

function parseIpv4(value: string): IpAddress | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const bytes: number[] = [];
  for (const part of parts) {
    if (!/^[0-9]{1,3}$/.test(part)) return null;
    const byte = Number(part);
    if (byte > 255) return null;
    bytes.push(byte);
  }
  return { family: 4, bytes };
}

/** The 16-bit groups of one `:`-separated half, with a trailing `a.b.c.d` allowed. */
function groupsOf(text: string): number[] | null {
  if (text === '') return [];
  const parts = text.split(':');
  const groups: number[] = [];
  for (const [index, part] of parts.entries()) {
    if (index === parts.length - 1 && part.includes('.')) {
      const embedded = parseIpv4(part);
      if (!embedded) return null;
      const [a, b, c, d] = embedded.bytes as [number, number, number, number];
      groups.push((a << 8) | b, (c << 8) | d);
      break;
    }
    if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
    groups.push(Number.parseInt(part, 16));
  }
  return groups;
}

function parseIpv6(value: string): IpAddress | null {
  if (!value.includes(':')) return null;
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const head = groupsOf(halves[0]!);
  const tail = halves.length === 2 ? groupsOf(halves[1]!) : [];
  if (!head || !tail) return null;
  let groups: number[];
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 1) return null;
    groups = [...head, ...(Array(fill).fill(0) as number[]), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  return { family: 6, bytes: groups.flatMap((group) => [group >> 8, group & 0xff]) };
}

/**
 * An IP literal, IPv4 or IPv6. Square brackets (as `URL.hostname` reports an
 * IPv6 host) are accepted; a zone id is not — `fe80::1%eth0` never reaches us
 * through a URL, and refusing to parse it means it is blocked.
 */
export function parseIpAddress(value: string): IpAddress | null {
  const literal = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
  return parseIpv4(literal) ?? parseIpv6(literal);
}

/** `true` when the host is an address rather than a name that has yet to resolve. */
export function isIpLiteral(value: string): boolean {
  return parseIpAddress(value) !== null;
}

function inRange(bytes: number[], cidr: string): boolean {
  const [network, prefixText] = cidr.split('/') as [string, string];
  const prefix = Number(prefixText);
  const base = parseIpAddress(network)!.bytes;
  for (let bit = 0; bit < prefix; bit += 8) {
    const index = bit >> 3;
    const mask = (0xff << Math.max(0, 8 - (prefix - bit))) & 0xff;
    if ((bytes[index]! & mask) !== (base[index]! & mask)) return false;
  }
  return true;
}

/**
 * The IPv4 address an IPv6 one carries, for the embeddings that reach a v4
 * destination: IPv4-mapped (`::ffff:a.b.c.d`), the deprecated IPv4-compatible
 * form (`::a.b.c.d`), NAT64 (`64:ff9b::/96`) and 6to4 (`2002::/16`). Without
 * this, `[::ffff:127.0.0.1]` would read as an unremarkable IPv6 address.
 */
function embeddedV4(bytes: number[]): number[] | null {
  if (inRange(bytes, '::ffff:0:0/96') || inRange(bytes, '64:ff9b::/96')) return bytes.slice(12);
  if (inRange(bytes, '2002::/16')) return bytes.slice(2, 6);
  // `::/96` minus the two addresses that are their own thing (`::` and `::1`).
  if (inRange(bytes, '::/96') && !inRange(bytes, '::/104')) return bytes.slice(12);
  return null;
}

/**
 * `true` unless `value` is an address on the public internet. Anything that
 * does not parse as an IP is blocked too: this is asked about resolved
 * addresses, where "unrecognisable" is a reason to refuse, not to proceed.
 */
export function isBlockedAddress(value: string): boolean {
  const ip = parseIpAddress(value);
  if (!ip) return true;
  if (ip.family === 4) return BLOCKED_V4.some((cidr) => inRange(ip.bytes, cidr));
  const v4 = embeddedV4(ip.bytes);
  if (v4) return BLOCKED_V4.some((cidr) => inRange(v4, cidr));
  return BLOCKED_V6.some((cidr) => inRange(ip.bytes, cidr));
}

/**
 * An `http`/`https` URL with a host: `null` for anything else, which is the
 * one answer both callers want for `file:`, `gopher:` and plain nonsense.
 */
export function parseHttpUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url.hostname === '' ? null : url;
}

/** The host of an `http`/`https` URL, without the brackets an IPv6 one carries. */
export function urlHost(value: string): string | null {
  const url = parseHttpUrl(value);
  if (!url) return null;
  return url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;
}

/**
 * `true` when the URL names an address the server must not fetch. A hostname
 * passes here — whether it *resolves* to a blocked address is only knowable
 * with DNS, which the API re-checks at download time.
 */
export function hasBlockedHost(value: string): boolean {
  const host = urlHost(value);
  if (host === null) return true;
  return isIpLiteral(host) && isBlockedAddress(host);
}
