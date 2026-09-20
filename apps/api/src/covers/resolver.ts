/**
 * The cover cascade for one ISBN: ask each provider for candidate URLs, in
 * order, and keep the first one that downloads as a real image (an `image/*`
 * reply of at least 50×50 px — Open Library's 1×1 "no cover" GIF and HTML
 * error pages are rejected here). Returns `null` when nobody had one.
 *
 * A provider that is down is skipped, but if nothing was found *and* some
 * provider failed, the miss is not trusted: a `TransientError` bubbles up so
 * the job retries instead of caching "no cover" for a month.
 */
import type { CoverSource } from '@bookguardian/shared';
import { downloadImage, TransientError, type DownloadContext } from './download';
import { InvalidImageError, processCover, type ProcessedCover } from './image';
import type { CoverProvider } from './providers';

export interface ResolvedCover {
  cover: ProcessedCover;
  source: CoverSource;
  url: string;
}

export interface CoverResolverOptions extends DownloadContext {
  providers: CoverProvider[];
  log?: (message: string) => void;
}

export type CoverResolver = (isbn13: string) => Promise<ResolvedCover | null>;

/** Download + validate one candidate; `null` when it is not a usable cover. */
export async function fetchCandidate(
  url: string,
  ctx: DownloadContext,
): Promise<ProcessedCover | null> {
  const download = await downloadImage(url, ctx);
  if (!download.ok) return null;
  try {
    return await processCover(download.body);
  } catch (error) {
    if (error instanceof InvalidImageError) return null;
    throw error;
  }
}

export function createCoverResolver({
  providers,
  log = () => undefined,
  ...ctx
}: CoverResolverOptions): CoverResolver {
  return async (isbn13) => {
    let failed: TransientError | null = null;
    for (const provider of providers) {
      try {
        const urls = await provider.candidates(isbn13, ctx);
        for (const url of urls) {
          const cover = await fetchCandidate(url, ctx);
          if (cover) return { cover, source: provider.name, url };
          log(`${provider.name}: ${url} is not a usable cover for ${isbn13}`);
        }
      } catch (error) {
        if (!(error instanceof TransientError)) throw error;
        failed = error;
        log(`${provider.name}: ${error.message}`);
      }
    }
    if (failed) throw failed;
    return null;
  };
}
