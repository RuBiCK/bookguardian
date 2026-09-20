/**
 * Where a cover image for an ISBN may be found, in the order the cascade
 * tries them. A provider only lists candidate URLs; the resolver downloads
 * and validates them, so a provider that answers with a 1×1 placeholder or
 * an HTML page costs one request and nothing else.
 */
import type { CoverSource } from '@bookguardian/shared';
import { TransientError } from './download';
import type { FetchLike } from '../lookup/types';

export interface CoverProviderContext {
  fetch: FetchLike;
  timeoutMs: number;
}

export interface CoverProvider {
  readonly name: Extract<CoverSource, 'open_library' | 'google_books'>;
  /** Candidate image URLs, best first. Empty = the provider knows no cover. */
  candidates(isbn13: string, ctx: CoverProviderContext): Promise<string[]>;
}

async function getJson<T>(url: string, ctx: CoverProviderContext): Promise<T | null> {
  let response: Response;
  try {
    response = await ctx.fetch(url, { signal: AbortSignal.timeout(ctx.timeoutMs) });
  } catch (error) {
    throw new TransientError(error instanceof Error ? error.message : 'request failed');
  }
  if (response.status === 404) return null;
  if (response.status === 429 || response.status >= 500) {
    throw new TransientError(`HTTP ${response.status} from ${url}`);
  }
  if (!response.ok) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// ---- Open Library --------------------------------------------------------

export interface OpenLibraryCoverOptions {
  /** Metadata host (`https://openlibrary.org`). */
  baseUrl: string;
  /** Image host (`https://covers.openlibrary.org`). */
  coversUrl: string;
}

interface OlEdition {
  covers?: unknown;
}

/**
 * Open Library: the edition record names its cover ids, and `/b/id/<id>-L.jpg`
 * is not rate limited. Only when the edition lists none do we try
 * `/b/isbn/<isbn>-L.jpg?default=false` (404 when unknown), which *is* limited
 * to ~100 requests per IP per 5 minutes.
 */
export function openLibraryCovers({ baseUrl, coversUrl }: OpenLibraryCoverOptions): CoverProvider {
  const base = baseUrl.replace(/\/$/, '');
  const covers = coversUrl.replace(/\/$/, '');
  return {
    name: 'open_library',
    async candidates(isbn13, ctx) {
      const edition = await getJson<OlEdition>(`${base}/isbn/${isbn13}.json`, ctx);
      const ids = Array.isArray(edition?.covers)
        ? edition.covers.filter((id): id is number => typeof id === 'number' && id > 0)
        : [];
      const byId = ids.slice(0, 2).map((id) => `${covers}/b/id/${id}-L.jpg`);
      return [...byId, `${covers}/b/isbn/${isbn13}-L.jpg?default=false`];
    },
  };
}

// ---- Google Books --------------------------------------------------------

export interface GoogleBooksCoverOptions {
  baseUrl: string;
  /** Without a key this provider is skipped entirely (anonymous quota is unusable). */
  apiKey?: string;
}

interface GoogleImageLinks {
  extraLarge?: string;
  large?: string;
  medium?: string;
  small?: string;
  thumbnail?: string;
  smallThumbnail?: string;
}

interface GoogleVolume {
  id?: string;
  volumeInfo?: { imageLinks?: GoogleImageLinks };
}

/** Google serves http links with a page-curl overlay baked in; ask for the clean https image. */
export function normalizeGoogleImageUrl(raw: string): string | null {
  const url = raw
    .trim()
    .replace(/^http:\/\//i, 'https://')
    .replace(/([?&])edge=curl(&|$)/g, (_m, before: string, after: string) => (after ? before : ''));
  return /^https:\/\/\S+$/.test(url) ? url : null;
}

/** Best available size, `large` → `medium` → `thumbnail` (then the tiny ones as a last resort). */
export function pickGoogleImage(links: GoogleImageLinks | undefined): string | null {
  if (!links) return null;
  for (const key of [
    'extraLarge',
    'large',
    'medium',
    'small',
    'thumbnail',
    'smallThumbnail',
  ] as const) {
    const raw = links[key];
    if (raw) {
      const url = normalizeGoogleImageUrl(raw);
      if (url) return url;
    }
  }
  return null;
}

export function googleBooksCovers({ baseUrl, apiKey }: GoogleBooksCoverOptions): CoverProvider {
  const base = baseUrl.replace(/\/$/, '');
  return {
    name: 'google_books',
    async candidates(isbn13, ctx) {
      if (!apiKey) return [];
      const list = new URLSearchParams({ q: `isbn:${isbn13}`, maxResults: '1', key: apiKey });
      const found = await getJson<{ items?: GoogleVolume[] }>(
        `${base}/volumes?${list.toString()}`,
        ctx,
      );
      const volume = found?.items?.[0];
      if (!volume) return [];
      const urls: string[] = [];
      // The list endpoint only carries thumbnails; the volume record has the large sizes.
      if (volume.id) {
        const detail = await getJson<GoogleVolume>(
          `${base}/volumes/${encodeURIComponent(volume.id)}?${new URLSearchParams({ key: apiKey }).toString()}`,
          ctx,
        );
        const large = pickGoogleImage(detail?.volumeInfo?.imageLinks);
        if (large) urls.push(large);
      }
      const listed = pickGoogleImage(volume.volumeInfo?.imageLinks);
      if (listed && !urls.includes(listed)) urls.push(listed);
      return urls;
    },
  };
}
