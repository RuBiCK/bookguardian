/**
 * Cover service: the in-process queue that gives every book a cover without
 * making anyone wait, the shared ISBN → asset cache in front of the
 * providers, user uploads, backfill and garbage collection.
 *
 * Adding or editing a book never blocks on the network: the book is saved,
 * a job is queued, and the cover lands a moment later (the DTO says
 * `coverPending` meanwhile so the app can poll). Jobs run one at a time,
 * provider traffic is spaced `minIntervalMs` apart (Open Library asks for
 * ≤ 1 req/s), and transient failures retry with exponential backoff, so a
 * flaky network never marks a book "no cover" for good. Only a confirmed
 * miss — every provider answered, none had an image — is cached, for
 * `missMs`, in `isbn_covers`.
 *
 * Ownership rules (ADR 0004): a cover found by ISBN is a shared asset
 * (`ownerId` null) that every book with that ISBN links to; a user's photo or
 * pasted URL is a private asset and sets `coverOverride`, after which the
 * cascade leaves the book alone.
 */
import type { CoverBackfillStatus, CoverSource, CoverVariant } from '@bookguardian/shared';
import type { BookRecord, Repositories } from '../db/repositories';
import type { FetchLike } from '../lookup/types';
import { TransientError } from './download';
import { InvalidImageError, processCover } from './image';
import { fetchCandidate, type CoverResolver } from './resolver';
import type { CoverStore } from './store';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CoverServiceOptions {
  repos: Repositories;
  store: CoverStore;
  /** The ISBN cascade (providers → download → WebP). */
  resolve: CoverResolver;
  /** Used for pasted cover URLs. */
  fetch?: FetchLike;
  timeoutMs?: number;
  /** How long "no provider has a cover" is remembered. */
  missMs?: number;
  /** Shared assets nobody references are deleted once older than this. */
  gcSharedAfterMs?: number;
  /** Assets younger than this survive a GC pass (an upload may still be linking them). */
  gcGraceMs?: number;
  /** Minimum spacing between provider round-trips. */
  minIntervalMs?: number;
  /** Retry budget for transient failures: attempts and the first delay (×4 each time). */
  retry?: { attempts: number; baseDelayMs: number };
  /** Daily GC period; `0` disables the timer (tests call `gc()` themselves). */
  gcIntervalMs?: number;
  now?: () => number;
  log?: (message: string) => void;
}

export interface UploadResult {
  book: BookRecord;
  assetId: string;
  /** `false` when a fallback photo arrived after a catalogue cover and was not used. */
  applied: boolean;
}

export interface GcResult {
  /** Asset ids removed (rows and files). */
  removed: string[];
}

export interface CoverService {
  /** Queue the ISBN cascade for a book (no-op without an ISBN or with a user override). */
  enqueueResolve(book: BookRecord): void;
  /** Queue a download of `url` as the book's own cover. */
  enqueueManualUrl(book: BookRecord, url: string): void;
  /** Store an uploaded photo as a private asset and attach it to the book. */
  importPhoto(
    ownerId: string,
    bookId: string,
    image: Buffer,
    options?: { fallback?: boolean },
  ): Promise<UploadResult | null>;
  /** Drop a user cover: back to the catalogue one (re-resolved if needed). */
  clearOverride(ownerId: string, bookId: string): Promise<BookRecord | null>;
  /** A job for this book is queued or running. */
  isPending(bookId: string): boolean;
  /** Bytes of a stored variant, `null` when the file is missing. */
  readFile(assetId: string, variant: CoverVariant): Promise<Buffer | null>;
  /** Queue every coverless book with an ISBN (one owner, or everyone at boot). Skips cached misses. */
  backfill(ownerId?: string): Promise<number>;
  backfillStatus(ownerId: string): CoverBackfillStatus;
  /** Delete unreferenced private assets, and unreferenced shared ones past the grace period. */
  gc(): Promise<GcResult>;
  /** Boot: GC, backfill everyone, start the daily GC timer. */
  start(): Promise<void>;
  /** Resolves once the queue is empty (tests, shutdown). */
  idle(): Promise<void>;
  /** Stop the timer and wait for the running job. */
  close(): Promise<void>;
}

type Job =
  | { kind: 'resolve'; ownerId: string; bookId: string; isbn13: string; backfill: boolean }
  | { kind: 'manual'; ownerId: string; bookId: string; url: string };

interface Stats extends CoverBackfillStatus {
  ids: Set<string>;
}

const emptyStats = (): Stats => ({
  queued: 0,
  pending: 0,
  done: 0,
  found: 0,
  failed: 0,
  ids: new Set(),
});

export function createCoverService({
  repos,
  store,
  resolve,
  fetch = (input, init) => globalThis.fetch(input, init),
  timeoutMs = 8_000,
  missMs = 30 * DAY_MS,
  gcSharedAfterMs = 90 * DAY_MS,
  gcGraceMs = 10 * 60 * 1000,
  minIntervalMs = 1000,
  retry = { attempts: 4, baseDelayMs: 1000 },
  gcIntervalMs = DAY_MS,
  now = Date.now,
  log = (message) => console.warn(`[covers] ${message}`),
}: CoverServiceOptions): CoverService {
  const queue: Job[] = [];
  const pending = new Map<string, number>();
  const stats = new Map<string, Stats>();
  const waiters: (() => void)[] = [];
  let running: Promise<void> | null = null;
  let lastNetworkAt = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  const iso = () => new Date(now()).toISOString();
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  function track(bookId: string, delta: 1 | -1) {
    const next = (pending.get(bookId) ?? 0) + delta;
    if (next <= 0) pending.delete(bookId);
    else pending.set(bookId, next);
  }

  function push(job: Job) {
    track(job.bookId, 1);
    queue.push(job);
    kick();
  }

  /** Start the worker if idle; wake `idle()` callers once nothing is left. */
  function kick() {
    if (running) return;
    if (queue.length === 0) {
      for (const wake of waiters.splice(0)) wake();
      return;
    }
    running = drain().finally(() => {
      running = null;
      kick();
    });
  }

  async function drain() {
    for (let job = queue.shift(); job; job = queue.shift()) {
      let found = false;
      let failed = false;
      try {
        found = await withRetries(job);
      } catch (error) {
        failed = true;
        log(`${job.kind} for book ${job.bookId} failed: ${describe(error)}`);
      } finally {
        track(job.bookId, -1);
        if (job.kind === 'resolve' && job.backfill) settle(job.ownerId, job.bookId, found, failed);
      }
    }
  }

  /** Transient errors retry with backoff; anything else fails the job right away. */
  async function withRetries(job: Job): Promise<boolean> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return job.kind === 'resolve' ? await runResolve(job) : await runManual(job);
      } catch (error) {
        if (!(error instanceof TransientError) || attempt + 1 >= retry.attempts) throw error;
        const delay = retry.baseDelayMs * 4 ** attempt;
        log(`${describe(error)}; retrying book ${job.bookId} in ${delay} ms`);
        await sleep(delay);
      }
    }
  }

  /** Space provider traffic out; jobs served from the cache never wait. */
  async function throttle() {
    const wait = lastNetworkAt + minIntervalMs - now();
    if (wait > 0) await sleep(wait);
    lastNetworkAt = now();
  }

  async function link(ownerId: string, bookId: string, assetId: string | null, override: boolean) {
    await repos.books.setCover(ownerId, bookId, assetId, override);
  }

  async function runResolve(job: Extract<Job, { kind: 'resolve' }>): Promise<boolean> {
    const book = await repos.books.findById(job.ownerId, job.bookId);
    // Deleted, re-edited to another ISBN, or the user picked their own cover meanwhile.
    if (!book || book.coverOverride || book.isbn13 !== job.isbn13) return false;

    const cached = await repos.isbnCovers.find(job.isbn13);
    if (cached?.coverAssetId) {
      if (book.coverAssetId !== cached.coverAssetId) {
        await link(job.ownerId, job.bookId, cached.coverAssetId, false);
      }
      return true;
    }
    if (cached?.missUntil && Date.parse(cached.missUntil) > now()) return false;

    await throttle();
    const resolved = await resolve(job.isbn13);
    if (!resolved) {
      await repos.isbnCovers.save({
        isbn13: job.isbn13,
        coverAssetId: null,
        source: null,
        fetchedAt: iso(),
        missUntil: new Date(now() + missMs).toISOString(),
      });
      return false;
    }
    await store.write(resolved.cover);
    const asset = await repos.coverAssets.upsert({
      ...dims(resolved.cover),
      source: resolved.source,
      ownerId: null,
      createdAt: iso(),
    });
    await repos.isbnCovers.save({
      isbn13: job.isbn13,
      coverAssetId: asset.id,
      source: resolved.source,
      fetchedAt: iso(),
      missUntil: null,
    });
    const current = await repos.books.findById(job.ownerId, job.bookId);
    if (current && !current.coverOverride) await link(job.ownerId, job.bookId, asset.id, false);
    return true;
  }

  async function runManual(job: Extract<Job, { kind: 'manual' }>): Promise<boolean> {
    const book = await repos.books.findById(job.ownerId, job.bookId);
    if (!book) return false;
    await throttle();
    const cover = await fetchCandidate(job.url, { fetch, timeoutMs });
    if (!cover) {
      log(`${job.url} is not a usable cover; book ${job.bookId} keeps its current one`);
      return false;
    }
    await store.write(cover);
    const asset = await repos.coverAssets.upsert({
      ...dims(cover),
      source: 'manual',
      ownerId: job.ownerId,
      createdAt: iso(),
    });
    await link(job.ownerId, job.bookId, asset.id, true);
    return true;
  }

  function settle(ownerId: string, bookId: string, found: boolean, failed: boolean) {
    const s = stats.get(ownerId);
    if (!s?.ids.has(bookId)) return;
    s.pending = Math.max(0, s.pending - 1);
    if (failed) s.failed += 1;
    else {
      s.done += 1;
      if (found) s.found += 1;
    }
  }

  async function removeAsset(id: string) {
    await repos.coverAssets.delete([id]);
    await store.remove(id);
  }

  const service: CoverService = {
    enqueueResolve(book) {
      if (!book.isbn13 || book.coverOverride) return;
      push({
        kind: 'resolve',
        ownerId: book.ownerId,
        bookId: book.id,
        isbn13: book.isbn13,
        backfill: false,
      });
    },
    enqueueManualUrl(book, url) {
      push({ kind: 'manual', ownerId: book.ownerId, bookId: book.id, url });
    },
    async importPhoto(ownerId, bookId, image, { fallback = false } = {}) {
      const book = await repos.books.findById(ownerId, bookId);
      if (!book) return null;
      const cover = await processCover(image); // throws InvalidImageError for non-images
      await store.write(cover);
      const asset = await repos.coverAssets.upsert({
        ...dims(cover),
        source: 'user_photo',
        ownerId,
        createdAt: iso(),
      });
      // A fallback only fills an empty slot; a catalogue cover that already
      // arrived (or a user's own) wins and the upload is left for the GC.
      if (fallback && (book.coverAssetId || book.coverOverride)) {
        return { book, assetId: asset.id, applied: false };
      }
      const linked = await repos.books.setCover(ownerId, bookId, asset.id, !fallback);
      return linked ? { book: linked, assetId: asset.id, applied: true } : null;
    },
    async clearOverride(ownerId, bookId) {
      const book = await repos.books.findById(ownerId, bookId);
      if (!book) return null;
      // Re-link the shared cover synchronously when it is cached, so the
      // book page swaps covers in one round-trip; otherwise the queue does it.
      const cached = book.isbn13 ? await repos.isbnCovers.find(book.isbn13) : null;
      const cleared = await repos.books.setCover(
        ownerId,
        bookId,
        cached?.coverAssetId ?? null,
        false,
      );
      if (cleared && !cached?.coverAssetId) service.enqueueResolve(cleared);
      return cleared;
    },
    isPending(bookId) {
      return pending.has(bookId);
    },
    readFile(assetId, variant) {
      return store.read(assetId, variant);
    },
    async backfill(ownerId) {
      const books = await repos.books.listMissingCovers(ownerId);
      const cache = await repos.isbnCovers.findMany(
        books.map((b) => b.isbn13).filter((isbn): isbn is string => isbn !== null),
      );
      const touched = new Set<string>();
      let queued = 0;
      for (const book of books) {
        if (!book.isbn13) continue;
        const known = cache.get(book.isbn13);
        if (known?.missUntil && !known.coverAssetId && Date.parse(known.missUntil) > now())
          continue;
        if (!touched.has(book.ownerId)) {
          stats.set(book.ownerId, emptyStats());
          touched.add(book.ownerId);
        }
        const s = stats.get(book.ownerId)!;
        s.queued += 1;
        s.pending += 1;
        s.ids.add(book.id);
        push({
          kind: 'resolve',
          ownerId: book.ownerId,
          bookId: book.id,
          isbn13: book.isbn13,
          backfill: true,
        });
        queued += 1;
      }
      if (ownerId && !touched.has(ownerId)) stats.set(ownerId, emptyStats());
      return queued;
    },
    backfillStatus(ownerId) {
      const s = stats.get(ownerId);
      return s
        ? { queued: s.queued, pending: s.pending, done: s.done, found: s.found, failed: s.failed }
        : { queued: 0, pending: 0, done: 0, found: 0, failed: 0 };
    },
    async gc() {
      const [byBooks, byIsbn, assets] = await Promise.all([
        repos.books.referencedCoverAssetIds(),
        repos.isbnCovers.referencedAssetIds(),
        repos.coverAssets.listAll(),
      ]);
      const removed: string[] = [];
      for (const asset of assets) {
        if (byBooks.has(asset.id) || byIsbn.has(asset.id)) continue;
        const age = now() - Date.parse(asset.createdAt);
        if (age < gcGraceMs) continue;
        if (asset.ownerId === null && age < gcSharedAfterMs) continue;
        await removeAsset(asset.id);
        removed.push(asset.id);
      }
      if (removed.length > 0) log(`gc removed ${removed.length} unreferenced cover(s)`);
      return { removed };
    },
    async start() {
      await service.gc().catch((error) => log(`gc failed: ${describe(error)}`));
      const queued = await service.backfill();
      if (queued > 0) log(`backfill queued ${queued} book(s) without a cover`);
      if (gcIntervalMs > 0) {
        timer = setInterval(() => {
          void service.gc().catch((error) => log(`gc failed: ${describe(error)}`));
        }, gcIntervalMs);
        timer.unref();
      }
    },
    idle() {
      if (!running && queue.length === 0) return Promise.resolve();
      return new Promise((resolve) => waiters.push(resolve));
    },
    async close() {
      if (timer) clearInterval(timer);
      queue.length = 0;
      await service.idle();
    },
  };
  return service;
}

function dims(cover: { id: string; width: number; height: number; bytes: number }) {
  return { id: cover.id, width: cover.width, height: cover.height, bytes: cover.bytes };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export { InvalidImageError };
export type { CoverSource };
