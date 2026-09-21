import type { BookDraft, BookSource } from '@bookguardian/shared';

/** Minimal fetch signature so providers can be tested with recorded fixtures. */
export type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<Response>;

export interface ProviderContext {
  fetch: FetchLike;
  /** Per-request budget; providers abort when it elapses. */
  timeoutMs: number;
}

/**
 * What a search asks for: free text (an OCR guess, "dune herbert") and/or
 * the fields of a partially filled add-book form. Every field is optional
 * but at least one is set; the ISBN is already normalised to 13 digits.
 */
export interface SearchQuery {
  q?: string;
  title?: string;
  author?: string;
  isbn13?: string;
  publisher?: string;
  year?: number;
}

export interface LookupProvider {
  readonly name: BookSource;
  /** `null` when the provider knows nothing about this ISBN-13. */
  byIsbn(isbn13: string, ctx: ProviderContext): Promise<BookDraft | null>;
  /** Best matches, most relevant first; structured fields are used where the provider supports them. */
  search(query: SearchQuery, limit: number, ctx: ProviderContext): Promise<BookDraft[]>;
}

/** Thrown by providers on network failure / non-2xx replies; the service degrades gracefully. */
export class ProviderError extends Error {
  constructor(
    public readonly provider: BookSource,
    message: string,
    public readonly status?: number,
  ) {
    super(`${provider}: ${message}`);
    this.name = 'ProviderError';
  }
}

export async function fetchJson<T>(
  ctx: ProviderContext,
  provider: BookSource,
  url: string,
): Promise<{ status: number; body: T | null }> {
  let response: Response;
  try {
    response = await ctx.fetch(url, { signal: AbortSignal.timeout(ctx.timeoutMs) });
  } catch (error) {
    throw new ProviderError(provider, error instanceof Error ? error.message : 'request failed');
  }
  if (response.status === 404) return { status: 404, body: null };
  if (!response.ok) throw new ProviderError(provider, `HTTP ${response.status}`, response.status);
  try {
    return { status: response.status, body: (await response.json()) as T };
  } catch {
    throw new ProviderError(provider, 'invalid JSON');
  }
}
