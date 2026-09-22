/**
 * Fetch an image URL into memory with the checks a cover needs: a 2xx
 * `image/*` reply under the size cap. Network trouble is `TransientError`
 * (worth retrying); anything else means "this URL is not a cover".
 *
 * Redirects are walked here rather than left to `fetch`, because every hop is
 * a fresh destination the SSRF guard has to see: a public host answering
 * `302 Location: http://169.254.169.254/` would otherwise reach the metadata
 * endpoint behind a URL that passed every check (BOOK-20).
 */
import type { FetchLike } from '../lookup/types';
import { BlockedUrlError, TransientError } from './errors';
import { defaultUrlGuard, type UrlGuard } from './guard';

export const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_REDIRECTS = 5;

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

export interface DownloadContext {
  fetch: FetchLike;
  timeoutMs: number;
  maxBytes?: number;
  /** Where this server may be pointed; defaults to the real-DNS policy. */
  guard?: UrlGuard;
  maxRedirects?: number;
}

export type Download =
  { ok: true; body: Buffer; contentType: string } | { ok: false; reason: string };

/** Nothing downstream reads a redirect's body; let the connection go. */
function discard(response: Response): void {
  void response.body?.cancel().catch(() => undefined);
}

export async function downloadImage(url: string, ctx: DownloadContext): Promise<Download> {
  const guard = ctx.guard ?? defaultUrlGuard;
  const maxRedirects = ctx.maxRedirects ?? MAX_REDIRECTS;
  let target = url;
  let response: Response;

  for (let hop = 0; ; hop += 1) {
    await guard(target); // BlockedUrlError: permanent, never retried
    try {
      response = await ctx.fetch(target, {
        signal: AbortSignal.timeout(ctx.timeoutMs),
        redirect: 'manual',
      });
    } catch (error) {
      throw new TransientError(error instanceof Error ? error.message : 'request failed');
    }
    if (!REDIRECT_STATUS.has(response.status)) break;

    const location = response.headers.get('location');
    discard(response);
    if (!location) return { ok: false, reason: `HTTP ${response.status} without a location` };
    if (hop >= maxRedirects) return { ok: false, reason: `more than ${maxRedirects} redirects` };
    try {
      target = new URL(location, target).toString();
    } catch {
      return { ok: false, reason: `unusable redirect target (${location})` };
    }
  }

  if (response.status === 429 || response.status >= 500) {
    throw new TransientError(`HTTP ${response.status} from ${target}`);
  }
  if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim();
  if (!contentType.startsWith('image/'))
    return { ok: false, reason: `not an image (${contentType})` };

  const declared = Number(response.headers.get('content-length') ?? 0);
  const max = ctx.maxBytes ?? MAX_DOWNLOAD_BYTES;
  if (declared > max) return { ok: false, reason: `too large (${declared} bytes)` };

  let body: Buffer;
  try {
    body = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    throw new TransientError(error instanceof Error ? error.message : 'read failed');
  }
  if (body.byteLength > max) return { ok: false, reason: `too large (${body.byteLength} bytes)` };
  if (body.byteLength === 0) return { ok: false, reason: 'empty body' };
  return { ok: true, body, contentType };
}

export { BlockedUrlError, TransientError };
