/**
 * The cover service: queue semantics (async, retries, dedupe by ISBN), the
 * shared-asset rules, uploads, backfill accounting and garbage collection.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRepositories, type BookRecord, type Repositories } from '../src/db/repositories';
import { seed, type SeedResult } from '../src/db/seed';
import { createTestDb, type TestDb } from './adapters';
import {
  coverJpeg,
  fixtureCovers,
  ISBN_FLAKY,
  ISBN_GOOGLE_ONLY,
  ISBN_NO_COVER,
  ISBN_WITH_COVER,
  OL_COVERS,
  photoJpeg,
  type FixtureCovers,
  type FixtureCoversOptions,
} from './cover-fixtures';

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-09-20T10:00:00.000Z');

describe('cover service', () => {
  let db: TestDb;
  let repos: Repositories;
  let base: SeedResult;
  let fx: FixtureCovers;
  let clock = T0;

  const setup = (options: FixtureCoversOptions = {}) => {
    fx = fixtureCovers(repos, { now: () => clock, ...options });
    return fx.service;
  };
  const addBook = (fields: Partial<BookRecord> & { title: string }, ownerId = base.userId) =>
    repos.books.create(ownerId, { shelfId: base.shelfId, ...fields });
  const providerCalls = () => fx.fetch.calls.filter((u) => u.startsWith(OL_COVERS));
  const file = (id: string) => join(fx.dir, id.slice(0, 2), `${id}.webp`);

  beforeEach(async () => {
    clock = T0;
    db = await createTestDb();
    repos = createRepositories(db.adapter);
    base = await seed(db.adapter);
  });
  afterEach(async () => {
    await fx.service.close();
    fx.cleanup();
    await db.cleanup();
  });

  it('resolves a cover in the background and stores one WebP file + thumb per hash', async () => {
    const covers = setup();
    const book = await addBook({ title: 'Dune', isbn13: ISBN_WITH_COVER });
    covers.enqueueResolve(book);
    expect(covers.isPending(book.id)).toBe(true);
    expect((await repos.books.findById(base.userId, book.id))?.coverAssetId).toBeNull();

    await covers.idle();
    expect(covers.isPending(book.id)).toBe(false);
    const linked = await repos.books.findById(base.userId, book.id);
    expect(linked?.coverAssetId).toMatch(/^[a-f0-9]{64}$/);
    expect(linked?.coverOverride).toBe(false);

    const asset = await repos.coverAssets.find(linked!.coverAssetId!);
    expect(asset).toMatchObject({ source: 'open_library', ownerId: null, width: 400, height: 600 });
    expect(existsSync(file(asset!.id))).toBe(true);
    expect(existsSync(join(fx.dir, asset!.id.slice(0, 2), `${asset!.id}-thumb.webp`))).toBe(true);
    expect(await repos.isbnCovers.find(ISBN_WITH_COVER)).toMatchObject({
      coverAssetId: asset!.id,
      source: 'open_library',
      missUntil: null,
    });
  });

  it('serves a second user of the same ISBN from the cache: one asset, one provider round-trip', async () => {
    const covers = setup();
    const other = await repos.users.create({ displayName: 'Other' });
    const first = await addBook({ title: 'Dune', isbn13: ISBN_WITH_COVER });
    const second = await addBook({ title: 'Dune (mine)', isbn13: ISBN_WITH_COVER }, other.id);
    covers.enqueueResolve(first);
    covers.enqueueResolve(second);
    await covers.idle();

    const a = await repos.books.findById(base.userId, first.id);
    const b = await repos.books.findById(other.id, second.id);
    expect(a?.coverAssetId).toBeTruthy();
    expect(b?.coverAssetId).toBe(a?.coverAssetId);
    expect(await repos.coverAssets.count()).toBe(1);
    expect(providerCalls()).toHaveLength(1);

    // Later additions, even after a restart, link without any network.
    const third = await addBook({ title: 'Dune again', isbn13: ISBN_WITH_COVER });
    covers.enqueueResolve(third);
    await covers.idle();
    expect((await repos.books.findById(base.userId, third.id))?.coverAssetId).toBe(a?.coverAssetId);
    expect(providerCalls()).toHaveLength(1);
  });

  it('caches a confirmed miss and retries it only after missMs', async () => {
    const covers = setup({ missMs: 30 * DAY });
    const book = await addBook({ title: 'Obscure', isbn13: ISBN_NO_COVER });
    covers.enqueueResolve(book);
    await covers.idle();
    expect((await repos.books.findById(base.userId, book.id))?.coverAssetId).toBeNull();
    const miss = await repos.isbnCovers.find(ISBN_NO_COVER);
    expect(miss).toMatchObject({ coverAssetId: null, source: null });
    expect(miss?.missUntil).toBe(new Date(T0 + 30 * DAY).toISOString());
    const before = fx.fetch.calls.length;

    covers.enqueueResolve(book);
    await covers.idle();
    expect(fx.fetch.calls.length).toBe(before); // nothing asked again

    clock = T0 + 31 * DAY;
    covers.enqueueResolve(book);
    await covers.idle();
    expect(fx.fetch.calls.length).toBeGreaterThan(before);
  });

  it('retries transient failures with backoff and never records a miss for them', async () => {
    const covers = setup({ retry: { attempts: 3, baseDelayMs: 1 } });
    const book = await addBook({ title: 'Flaky', isbn13: ISBN_FLAKY });
    covers.enqueueResolve(book);
    await covers.idle();
    expect(fx.fetch.calls.filter((u) => u.includes('/b/id/999-L.jpg'))).toHaveLength(3);
    expect(fx.log.filter((m) => m.includes('retrying'))).toHaveLength(2);
    expect(fx.log.at(-1)).toMatch(/failed: HTTP 503/);
    expect(await repos.isbnCovers.find(ISBN_FLAKY)).toBeNull();
    expect((await repos.books.findById(base.userId, book.id))?.coverAssetId).toBeNull();

    // The network recovers: the next attempt succeeds.
    fx.fetch.route(async (url) =>
      url.pathname === '/b/id/999-L.jpg'
        ? { status: 200, body: await coverJpeg(9), type: 'image/jpeg' }
        : undefined,
    );
    covers.enqueueResolve(book);
    await covers.idle();
    expect((await repos.books.findById(base.userId, book.id))?.coverAssetId).toBeTruthy();
  });

  it('skips Google Books without a key and uses it with one', async () => {
    const without = setup();
    const book = await addBook({ title: 'Google only', isbn13: ISBN_GOOGLE_ONLY });
    without.enqueueResolve(book);
    await without.idle();
    expect((await repos.books.findById(base.userId, book.id))?.coverAssetId).toBeNull();
    expect(await repos.isbnCovers.find(ISBN_GOOGLE_ONLY)).toMatchObject({ coverAssetId: null });
    await without.close();
    fx.cleanup();

    clock = T0 + 40 * DAY; // past the cached miss
    const withKey = setup({ apiKey: 'k' });
    withKey.enqueueResolve(book);
    await withKey.idle();
    const linked = await repos.books.findById(base.userId, book.id);
    expect(linked?.coverAssetId).toBeTruthy();
    expect(await repos.coverAssets.find(linked!.coverAssetId!)).toMatchObject({
      source: 'google_books',
      ownerId: null,
    });
  });

  it('leaves a book alone once the user chose their own cover, and clears it on request', async () => {
    const covers = setup();
    const book = await addBook({ title: 'Mine', isbn13: ISBN_WITH_COVER });
    const upload = await covers.importPhoto(base.userId, book.id, await photoJpeg());
    expect(upload?.applied).toBe(true);
    expect(upload?.book).toMatchObject({ coverOverride: true, coverAssetId: upload?.assetId });
    expect(await repos.coverAssets.find(upload!.assetId)).toMatchObject({
      source: 'user_photo',
      ownerId: base.userId,
      width: 800,
      height: 600,
    });

    covers.enqueueResolve(await repos.books.findById(base.userId, book.id).then((b) => b!));
    await covers.idle();
    expect(providerCalls()).toHaveLength(0);
    expect((await repos.books.findById(base.userId, book.id))?.coverAssetId).toBe(upload?.assetId);

    const cleared = await covers.clearOverride(base.userId, book.id);
    expect(cleared).toMatchObject({ coverAssetId: null, coverOverride: false });
    await covers.idle();
    const resolved = await repos.books.findById(base.userId, book.id);
    expect(resolved?.coverAssetId).toBeTruthy();
    expect(resolved?.coverAssetId).not.toBe(upload?.assetId);
  });

  it('uses a fallback photo only while no catalogue cover exists', async () => {
    const covers = setup();
    // Cascade finds nothing → the scan photo stays.
    const noCover = await addBook({ title: 'Unknown', isbn13: ISBN_NO_COVER });
    covers.enqueueResolve(noCover);
    await covers.idle();
    const kept = await covers.importPhoto(base.userId, noCover.id, await photoJpeg(), {
      fallback: true,
    });
    expect(kept).toMatchObject({ applied: true });
    expect(kept?.book).toMatchObject({ coverOverride: false, coverAssetId: kept?.assetId });

    // Cascade already found one → the photo is not applied (and the GC will drop it).
    const withCover = await addBook({ title: 'Dune', isbn13: ISBN_WITH_COVER });
    covers.enqueueResolve(withCover);
    await covers.idle();
    const shared = (await repos.books.findById(base.userId, withCover.id))!.coverAssetId;
    const ignored = await covers.importPhoto(base.userId, withCover.id, await photoJpeg(), {
      fallback: true,
    });
    expect(ignored).toMatchObject({ applied: false });
    expect((await repos.books.findById(base.userId, withCover.id))?.coverAssetId).toBe(shared);

    // Photo first, cascade later → the shared cover replaces the fallback.
    const late = await addBook({ title: 'Dune 2', isbn13: ISBN_WITH_COVER });
    const early = await covers.importPhoto(base.userId, late.id, await photoJpeg(), {
      fallback: true,
    });
    expect(early?.applied).toBe(true);
    covers.enqueueResolve(late);
    await covers.idle();
    expect((await repos.books.findById(base.userId, late.id))?.coverAssetId).toBe(shared);
  });

  it('downloads a pasted URL as a private cover and ignores non-images', async () => {
    const covers = setup();
    const book = await addBook({ title: 'Pasted' });
    covers.enqueueManualUrl(book, 'https://pictures.test/cover.jpg');
    await covers.idle();
    const linked = await repos.books.findById(base.userId, book.id);
    expect(linked?.coverOverride).toBe(true);
    expect(await repos.coverAssets.find(linked!.coverAssetId!)).toMatchObject({
      source: 'manual',
      ownerId: base.userId,
    });

    for (const bad of ['https://pictures.test/page.html', 'https://pictures.test/tiny.png']) {
      covers.enqueueManualUrl(book, bad);
      await covers.idle();
      expect((await repos.books.findById(base.userId, book.id))?.coverAssetId).toBe(
        linked?.coverAssetId,
      );
    }
    expect(fx.log.filter((m) => m.includes('not a usable cover'))).toHaveLength(2);
  });

  it('makes identical bytes one shared asset whoever brings them', async () => {
    const covers = setup();
    const other = await repos.users.create({ displayName: 'Other' });
    const mine = await addBook({ title: 'A' });
    const theirs = await addBook({ title: 'B' }, other.id);
    const a = await covers.importPhoto(base.userId, mine.id, await photoJpeg());
    expect(await repos.coverAssets.find(a!.assetId)).toMatchObject({ ownerId: base.userId });
    const b = await covers.importPhoto(other.id, theirs.id, await photoJpeg());
    expect(b?.assetId).toBe(a?.assetId);
    expect(await repos.coverAssets.find(a!.assetId)).toMatchObject({ ownerId: null });
    expect(await repos.coverAssets.count()).toBe(1);
  });

  it('backfills only coverless books with an ISBN, skipping cached misses, and counts progress', async () => {
    const covers = setup({ apiKey: 'k' });
    const other = await repos.users.create({ displayName: 'Other' });
    await addBook({ title: 'No ISBN' });
    const withCover = await addBook({ title: 'Dune', isbn13: ISBN_WITH_COVER });
    const google = await addBook({ title: 'Google', isbn13: ISBN_GOOGLE_ONLY });
    const missing = await addBook({ title: 'Nothing', isbn13: ISBN_NO_COVER });
    const flaky = await addBook({ title: 'Flaky', isbn13: ISBN_FLAKY });
    const theirs = await addBook({ title: 'Theirs', isbn13: ISBN_WITH_COVER }, other.id);
    await repos.isbnCovers.save({
      isbn13: ISBN_NO_COVER,
      coverAssetId: null,
      source: null,
      fetchedAt: new Date(T0).toISOString(),
      missUntil: new Date(T0 + DAY).toISOString(),
    });

    expect(await covers.backfill(base.userId)).toBe(3);
    expect(covers.backfillStatus(base.userId)).toMatchObject({ queued: 3, pending: 3, done: 0 });
    expect(covers.backfillStatus(other.id)).toEqual({
      queued: 0,
      pending: 0,
      done: 0,
      found: 0,
      failed: 0,
    });
    await covers.idle();
    expect(covers.backfillStatus(base.userId)).toEqual({
      queued: 3,
      pending: 0,
      done: 2,
      found: 2,
      failed: 1,
    });
    const ids = await Promise.all(
      [withCover, google, missing, flaky, theirs].map((b) =>
        repos.books.findById(b.ownerId, b.id).then((r) => r?.coverAssetId ?? null),
      ),
    );
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBeTruthy();
    expect(ids[2]).toBeNull();
    expect(ids[3]).toBeNull();
    expect(ids[4]).toBeNull(); // another owner's book: not part of this run

    // Everyone (boot): the other user's book is picked up, cached ISBN → no network.
    const before = providerCalls().length;
    expect(await covers.backfill()).toBe(2); // theirs + flaky (never cached)
    await covers.idle();
    expect((await repos.books.findById(other.id, theirs.id))?.coverAssetId).toBe(ids[0]);
    expect(covers.backfillStatus(other.id)).toMatchObject({ queued: 1, done: 1, found: 1 });
    expect(providerCalls().filter((u) => u.includes('15166231')).length).toBe(
      providerCalls()
        .slice(0, before)
        .filter((u) => u.includes('15166231')).length,
    );
  });

  it('gc removes orphaned private assets now and orphaned shared ones after 90 days', async () => {
    const covers = setup({ gcSharedAfterMs: 90 * DAY });
    const photoBook = await addBook({ title: 'Photo' });
    const photo = (await covers.importPhoto(base.userId, photoBook.id, await photoJpeg()))!;
    const isbnBook = await addBook({ title: 'Dune', isbn13: ISBN_WITH_COVER });
    covers.enqueueResolve(isbnBook);
    await covers.idle();
    const shared = (await repos.books.findById(base.userId, isbnBook.id))!.coverAssetId!;

    // Everything referenced: nothing to do.
    expect((await covers.gc()).removed).toEqual([]);

    await repos.books.delete(base.userId, photoBook.id);
    await repos.books.delete(base.userId, isbnBook.id);
    clock = T0 + 1000;
    // The private photo goes; the shared cover stays (isbn_covers still points at it).
    expect((await covers.gc()).removed).toEqual([photo.assetId]);
    expect(existsSync(file(photo.assetId))).toBe(false);
    expect(await repos.coverAssets.find(photo.assetId)).toBeNull();
    expect(existsSync(file(shared))).toBe(true);

    // The ISBN resolves to a new image later: the old shared file is orphaned…
    await repos.isbnCovers.save({
      isbn13: ISBN_WITH_COVER,
      coverAssetId: null,
      source: null,
      fetchedAt: new Date(clock).toISOString(),
      missUntil: null,
    });
    expect((await covers.gc()).removed).toEqual([]); // …but still young
    clock = T0 + 91 * DAY;
    expect((await covers.gc()).removed).toEqual([shared]);
    expect(existsSync(file(shared))).toBe(false);
  });

  it('start() sweeps, backfills everyone and reports, without leaving timers behind', async () => {
    const covers = setup();
    const book = await addBook({ title: 'Dune', isbn13: ISBN_WITH_COVER });
    await covers.start();
    await covers.idle();
    expect((await repos.books.findById(base.userId, book.id))?.coverAssetId).toBeTruthy();
    expect(fx.log).toContain('backfill queued 1 book(s) without a cover');
  });
});
