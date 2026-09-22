/**
 * The SSRF policy for URLs a user hands us (BOOK-20).
 *
 * `POST /api/books` accepts a `coverUrl` that this server then fetches, so an
 * authenticated user picks the destination of a server-side GET. The shared
 * schema has already refused everything but `http`/`https` and literal
 * private addresses; what is left is a *hostname*, and a hostname resolving
 * to `127.0.0.1` looks exactly like one resolving to a CDN until DNS answers.
 * So the guard resolves it and classifies every address that comes back, and
 * `downloadImage` runs it again on each redirect target rather than letting
 * `fetch` follow a public host to the metadata endpoint on its own.
 *
 * The one exemption is the origins this deployment was *configured* with:
 * a self-hosted Open Library mirror or the e2e provider stub lives on the
 * LAN or on localhost by design, and no user can point the cascade anywhere
 * else. Pasted URLs are guarded without it.
 *
 * Known gap: between this lookup and the socket, the name is resolved a
 * second time by `fetch` itself, so a record that flips answers (DNS
 * rebinding) can still slip past. Closing it means pinning the checked
 * address into the connection, which needs a custom dispatcher — worth doing,
 * but the deny-list is what stops the straightforward attack today.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import { isBlockedAddress, isIpLiteral, parseHttpUrl } from '@bookguardian/shared';
import { BlockedUrlError, TransientError } from './errors';

/** Hostname → every address it resolves to. Injected so tests need no DNS. */
export type AddressLookup = (hostname: string) => Promise<string[]>;

export const dnsAddressLookup: AddressLookup = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

/** Throws `BlockedUrlError` when this URL must not be fetched. */
export type UrlGuard = (url: string) => Promise<void>;

export interface UrlGuardOptions {
  lookup?: AddressLookup;
  /**
   * Origins that skip the address check. Only ever the metadata and image
   * hosts the *operator* configured: where those live is a deployment
   * decision — a self-hosted Open Library mirror on the LAN, a stub on
   * localhost — and not something a user can steer. URLs a user supplies go
   * through a guard built without this.
   */
  allow?: string[];
}

export function createUrlGuard({
  lookup = dnsAddressLookup,
  allow = [],
}: UrlGuardOptions = {}): UrlGuard {
  const allowed = new Set(
    allow.map((origin) => parseHttpUrl(origin)?.origin).filter((origin) => origin !== undefined),
  );
  return async (url) => {
    // `parseHttpUrl` is `null` for an unparseable URL and for every scheme
    // but http/https — `file:///etc/passwd` and `gopher://127.0.0.1:11211/_x`
    // stop here instead of throwing inside `fetch` and reading as transient.
    const parsed = parseHttpUrl(url);
    if (!parsed) throw new BlockedUrlError(`${url} is not an http(s) URL`);
    if (allowed.has(parsed.origin)) return;
    const host = parsed.hostname.startsWith('[') ? parsed.hostname.slice(1, -1) : parsed.hostname;
    if (isIpLiteral(host)) {
      if (isBlockedAddress(host)) throw new BlockedUrlError(`${host} is not a public address`);
      return;
    }
    let addresses: string[];
    try {
      addresses = await lookup(host);
    } catch (error) {
      // A name that does not resolve is a network problem, not a policy one:
      // `fetch` would have failed the same way, and the queue may retry.
      throw new TransientError(
        `cannot resolve ${host}: ${error instanceof Error ? error.message : 'lookup failed'}`,
      );
    }
    if (addresses.length === 0) throw new TransientError(`${host} resolved to no address`);
    for (const address of addresses) {
      if (isBlockedAddress(address)) {
        throw new BlockedUrlError(`${host} resolves to ${address}, which is not a public address`);
      }
    }
  };
}

/** The guard the download layer uses unless a caller injects its own. */
export const defaultUrlGuard: UrlGuard = createUrlGuard();
