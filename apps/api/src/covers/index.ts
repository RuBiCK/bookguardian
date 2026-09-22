export { createCoverService, InvalidImageError, type CoverService } from './service';
export { createCoverStore, type CoverStore } from './store';
export { createCoverResolver, type CoverResolver, type ResolvedCover } from './resolver';
export {
  googleBooksCovers,
  normalizeGoogleImageUrl,
  openLibraryCovers,
  pickGoogleImage,
  type CoverProvider,
} from './providers';
export { processCover, MIN_COVER_SIDE_PX, type ProcessedCover } from './image';
export { downloadImage, MAX_REDIRECTS } from './download';
export { BlockedUrlError, TransientError } from './errors';
export {
  createUrlGuard,
  defaultUrlGuard,
  dnsAddressLookup,
  type AddressLookup,
  type UrlGuard,
} from './guard';

import type { Repositories } from '../db/repositories';
import { createUrlGuard } from './guard';
import { createCoverResolver } from './resolver';
import { createCoverService, type CoverService } from './service';
import { createCoverStore } from './store';
import { googleBooksCovers, openLibraryCovers } from './providers';

export interface DefaultCoverConfig {
  dir: string;
  openLibraryUrl: string;
  openLibraryCoversUrl: string;
  googleBooksUrl: string;
  googleBooksApiKey?: string;
  timeoutMs: number;
  missMs: number;
  gcSharedAfterMs: number;
  minIntervalMs: number;
}

/** The production wiring: Open Library → Google Books (with key), global fetch, files under `dir`. */
export function createDefaultCoverService(
  config: DefaultCoverConfig,
  repos: Repositories,
  extras: { gcHooks?: (() => Promise<void>)[] } = {},
): CoverService {
  const log = (message: string) => console.warn(`[covers] ${message}`);
  if (!config.googleBooksApiKey) {
    console.info('[covers] GOOGLE_BOOKS_API_KEY not set: Google Books covers are skipped');
  }
  const fetch = (
    input: string,
    init?: { signal?: AbortSignal; redirect?: 'follow' | 'manual' | 'error' },
  ) => globalThis.fetch(input, init);
  // Two guards, because the two paths differ in who chose the URL: candidate
  // covers come from the hosts this deployment was configured with, pasted
  // ones come from whoever is logged in and get the address policy with no
  // exemptions (BOOK-20).
  const providerGuard = createUrlGuard({
    allow: [config.openLibraryUrl, config.openLibraryCoversUrl, config.googleBooksUrl],
  });
  return createCoverService({
    repos,
    store: createCoverStore(config.dir),
    resolve: createCoverResolver({
      providers: [
        openLibraryCovers({
          baseUrl: config.openLibraryUrl,
          coversUrl: config.openLibraryCoversUrl,
        }),
        googleBooksCovers({ baseUrl: config.googleBooksUrl, apiKey: config.googleBooksApiKey }),
      ],
      fetch,
      guard: providerGuard,
      timeoutMs: config.timeoutMs,
      log,
    }),
    fetch,
    timeoutMs: config.timeoutMs,
    missMs: config.missMs,
    gcSharedAfterMs: config.gcSharedAfterMs,
    minIntervalMs: config.minIntervalMs,
    gcHooks: extras.gcHooks,
    log,
  });
}
