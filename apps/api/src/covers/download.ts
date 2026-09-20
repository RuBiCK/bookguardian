/**
 * Fetch an image URL into memory with the checks a cover needs: a 2xx
 * `image/*` reply under the size cap. Network trouble is `TransientError`
 * (worth retrying); anything else means "this URL is not a cover".
 */
import type { FetchLike } from '../lookup/types';

export const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;

export interface DownloadContext {
  fetch: FetchLike;
  timeoutMs: number;
  maxBytes?: number;
}

/** The provider or network failed in a way that may succeed later. */
export class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientError';
  }
}

export type Download =
  { ok: true; body: Buffer; contentType: string } | { ok: false; reason: string };

export async function downloadImage(url: string, ctx: DownloadContext): Promise<Download> {
  let response: Response;
  try {
    response = await ctx.fetch(url, { signal: AbortSignal.timeout(ctx.timeoutMs) });
  } catch (error) {
    throw new TransientError(error instanceof Error ? error.message : 'request failed');
  }
  if (response.status === 429 || response.status >= 500) {
    throw new TransientError(`HTTP ${response.status} from ${url}`);
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
