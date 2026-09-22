/**
 * The two ways fetching a cover can fail, kept apart because the queue treats
 * them differently: a `TransientError` is retried with backoff, anything else
 * fails the job once and for good.
 */

/** The provider or network failed in a way that may succeed later. */
export class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientError';
  }
}

/**
 * The URL points somewhere the server refuses to go (see `guard.ts`). Never a
 * `TransientError`: retrying cannot make a blocked address allowed, and four
 * attempts with backoff would only hand the caller a timing oracle.
 */
export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedUrlError';
  }
}
