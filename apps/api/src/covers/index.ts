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
export { downloadImage, TransientError } from './download';

import type { Repositories } from '../db/repositories';
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
): CoverService {
  const log = (message: string) => console.warn(`[covers] ${message}`);
  if (!config.googleBooksApiKey) {
    console.info('[covers] GOOGLE_BOOKS_API_KEY not set: Google Books covers are skipped');
  }
  const fetch = (input: string, init?: { signal?: AbortSignal }) => globalThis.fetch(input, init);
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
      timeoutMs: config.timeoutMs,
      log,
    }),
    fetch,
    timeoutMs: config.timeoutMs,
    missMs: config.missMs,
    gcSharedAfterMs: config.gcSharedAfterMs,
    minIntervalMs: config.minIntervalMs,
    log,
  });
}
