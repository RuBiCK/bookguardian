/**
 * HTTP contract of covers: the DTO's computed fields, the file endpoint and
 * its cache headers, private-cover access, uploads and the backfill.
 */
import sharp from 'sharp';
import { COVER_UPLOAD_MAX_BYTES, type Book, type CoverBackfillStatus } from '@bookguardian/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, json, MISSING_ID, OWNER_HEADER, type ErrorBody, type TestApp } from './app';
import {
  coverJpeg,
  ISBN_GOOGLE_ONLY,
  ISBN_NO_COVER,
  ISBN_WITH_COVER,
  photoJpeg,
} from './cover-fixtures';

describe('/api/covers and book covers', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await createTestApp({ covers: { apiKey: 'k' } });
  });
  afterEach(async () => {
    await t.cleanup();
  });

  const add = async (body: Record<string, unknown>, headers: Record<string, string> = {}) => {
    const r = await t.app.request('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: (await r.json()) as Book };
  };
  const upload = async (
    id: string,
    image: Buffer,
    query = '',
    headers: Record<string, string> = {},
  ) => {
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(image)], { type: 'image/jpeg' }), 'cover.jpg');
    const r = await t.app.request(`/api/books/${id}/cover${query}`, {
      method: 'POST',
      body: form,
      headers,
    });
    return { status: r.status, body: (await r.json()) as Book & ErrorBody };
  };
  const settled = async (id: string) => {
    await t.covers.service.idle();
    return (await json<Book>(t.app, 'GET', `/api/books/${id}`)).body;
  };

  it('adds a book with an ISBN, then serves its cover from the API with immutable caching', async () => {
    const created = await add({ title: 'Dune', isbn13: ISBN_WITH_COVER });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ coverAssetId: null, coverUrl: null, coverPending: true });

    const book = await settled(created.body.id);
    expect(book.coverPending).toBe(false);
    expect(book.coverAssetId).toMatch(/^[a-f0-9]{64}$/);
    expect(book.coverUrl).toBe(`/api/covers/${book.coverAssetId}.webp`);
    expect(book.coverOverride).toBe(false);

    const full = await t.app.request(book.coverUrl!);
    expect(full.status).toBe(200);
    expect(full.headers.get('content-type')).toBe('image/webp');
    expect(full.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(full.headers.get('etag')).toBe(`"${book.coverAssetId}"`);
    expect(full.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    const bytes = Buffer.from(await full.arrayBuffer());
    expect(full.headers.get('content-length')).toBe(String(bytes.byteLength));
    expect(await sharp(bytes).metadata()).toMatchObject({ format: 'webp', height: 600 });

    const thumb = await t.app.request(`/api/covers/${book.coverAssetId}-thumb.webp`);
    expect(thumb.status).toBe(200);
    expect(thumb.headers.get('etag')).toBe(`"${book.coverAssetId}-thumb"`);
    expect(await sharp(Buffer.from(await thumb.arrayBuffer())).metadata()).toMatchObject({
      height: 200,
    });

    const cached = await t.app.request(book.coverUrl!, {
      headers: { 'If-None-Match': `"${book.coverAssetId}"` },
    });
    expect(cached.status).toBe(304);

    expect((await t.app.request(`/api/covers/${'0'.repeat(64)}.webp`)).status).toBe(404);
    expect((await t.app.request('/api/covers/../etc/passwd')).status).toBe(404);
    expect((await t.app.request('/api/covers/nope.webp')).status).toBe(422);
  });

  it('shares one asset between two users adding the same ISBN', async () => {
    const other = await t.repos.users.create({ displayName: 'Other' });
    const library = await t.repos.libraries.create(other.id, { name: 'Theirs' });
    const shelf = await t.repos.shelves.create(other.id, { libraryId: library.id, name: 'S' });
    const mine = await add({ title: 'Dune', isbn13: ISBN_WITH_COVER });
    const theirs = await add(
      { title: 'Dune', isbn13: ISBN_WITH_COVER, shelfId: shelf.id },
      { [OWNER_HEADER]: other.id },
    );
    expect(theirs.status).toBe(201);
    expect(theirs.body.ownerId).toBe(other.id);
    await t.covers.service.idle();
    const a = await settled(mine.body.id);
    const b = (await (
      await t.app.request(`/api/books/${theirs.body.id}`, {
        headers: { [OWNER_HEADER]: other.id },
      })
    ).json()) as Book;
    expect(a.coverAssetId).toBeTruthy();
    expect(b.coverAssetId).toBe(a.coverAssetId);
    expect(await t.repos.coverAssets.count()).toBe(1);
    expect(t.covers.fetch.calls.filter((u) => u.includes('15166231-L.jpg'))).toHaveLength(1);
  });

  it('keeps an uploaded photo private: 404 for another user, visible through a library share', async () => {
    const other = await t.repos.users.create({ displayName: 'Other' });
    const created = await add({ title: 'Mine' });
    const uploaded = await upload(created.body.id, await photoJpeg());
    expect(uploaded.status).toBe(200);
    expect(uploaded.body).toMatchObject({ coverOverride: true, coverPending: false });
    expect(uploaded.body.coverUrl).toBe(`/api/covers/${uploaded.body.coverAssetId}.webp`);

    const own = await t.app.request(uploaded.body.coverUrl!);
    expect(own.status).toBe(200);
    expect(own.headers.get('cache-control')).toBe('private, max-age=31536000, immutable');

    const stranger = await t.app.request(uploaded.body.coverUrl!, {
      headers: { [OWNER_HEADER]: other.id },
    });
    expect(stranger.status).toBe(404);

    await t.repos.libraryShares.create({ libraryId: t.base.libraryId, granteeId: other.id });
    const viewer = await t.app.request(uploaded.body.coverUrl!, {
      headers: { [OWNER_HEADER]: other.id },
    });
    expect(viewer.status).toBe(200);
  });

  it('rejects non-images, missing files and unknown books on upload', async () => {
    const created = await add({ title: 'X' });
    const html = await upload(created.body.id, Buffer.from('<html>no</html>'));
    expect(html.status).toBe(422);
    expect(html.body.error.code).toBe('invalid_image');

    const empty = await t.app.request(`/api/books/${created.body.id}/cover`, {
      method: 'POST',
      body: new FormData(),
    });
    expect(empty.status).toBe(422);

    expect((await upload(MISSING_ID, await coverJpeg(4))).status).toBe(404);

    const huge = await upload(created.body.id, Buffer.alloc(COVER_UPLOAD_MAX_BYTES + 1024, 1));
    expect(huge.status).toBe(413);
    expect(huge.body.error.code).toBe('cover_too_large');
    const badQuery = await t.app.request(`/api/books/${created.body.id}/cover?fallback=maybe`, {
      method: 'POST',
      body: new FormData(),
    });
    expect(badQuery.status).toBe(422);
  });

  it('applies a fallback photo only until the catalogue cover arrives, and DELETE restores it', async () => {
    const created = await add({ title: 'Dune', isbn13: ISBN_WITH_COVER });
    const shared = (await settled(created.body.id)).coverAssetId;
    const late = await upload(created.body.id, await photoJpeg(), '?fallback=true');
    expect(late.status).toBe(202);
    expect(late.body.coverAssetId).toBe(shared);

    const orphan = await add({ title: 'Orphan', isbn13: ISBN_NO_COVER });
    await t.covers.service.idle();
    const applied = await upload(orphan.body.id, await photoJpeg(), '?fallback=true');
    expect(applied.status).toBe(200);
    expect(applied.body).toMatchObject({ coverOverride: false });
    expect(applied.body.coverAssetId).not.toBe(shared);

    const own = await upload(created.body.id, await photoJpeg());
    expect(own.body).toMatchObject({ coverOverride: true });
    expect(own.body.coverAssetId).not.toBe(shared);
    const restored = await json<Book>(t.app, 'DELETE', `/api/books/${created.body.id}/cover`);
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ coverAssetId: shared, coverOverride: false });
    expect((await json(t.app, 'DELETE', `/api/books/${MISSING_ID}/cover`)).status).toBe(404);
  });

  it('treats coverUrl on create/update as "use this image as my cover"', async () => {
    const created = await add({ title: 'Pasted', coverUrl: 'https://pictures.test/cover.jpg' });
    expect(created.body.coverPending).toBe(true);
    const book = await settled(created.body.id);
    expect(book.coverOverride).toBe(true);
    expect(book.coverUrl).toMatch(/^\/api\/covers\/[a-f0-9]{64}\.webp$/);

    // Changing the ISBN drops a shared cover and resolves the new one; a user cover stays.
    const patched = await json<Book>(t.app, 'PATCH', `/api/books/${book.id}`, {
      isbn13: ISBN_WITH_COVER,
    });
    expect(patched.body.coverAssetId).toBe(book.coverAssetId);
    const dropped = await json<Book>(t.app, 'PATCH', `/api/books/${book.id}`, { coverUrl: null });
    expect(dropped.body).toMatchObject({
      coverAssetId: null,
      coverOverride: false,
      coverPending: true,
    });
    const resolved = await settled(book.id);
    expect(resolved.coverAssetId).toBeTruthy();
    expect(resolved.coverAssetId).not.toBe(book.coverAssetId);

    const moved = await json<Book>(t.app, 'PATCH', `/api/books/${book.id}`, {
      isbn13: ISBN_GOOGLE_ONLY,
    });
    expect(moved.body).toMatchObject({ coverAssetId: null, coverPending: true });
    expect((await settled(book.id)).coverAssetId).not.toBe(resolved.coverAssetId);
  });

  it('backfills the caller’s coverless books and reports progress', async () => {
    const a = await t.repos.books.create(t.base.userId, {
      shelfId: t.base.shelfId,
      title: 'A',
      isbn13: ISBN_WITH_COVER,
    });
    await t.repos.books.create(t.base.userId, { shelfId: t.base.shelfId, title: 'No ISBN' });
    const c = await t.repos.books.create(t.base.userId, {
      shelfId: t.base.shelfId,
      title: 'C',
      isbn13: ISBN_NO_COVER,
    });
    expect((await json<CoverBackfillStatus>(t.app, 'GET', '/api/covers/backfill')).body).toEqual({
      queued: 0,
      pending: 0,
      done: 0,
      found: 0,
      failed: 0,
    });
    const started = await json<{ queued: number }>(t.app, 'POST', '/api/covers/backfill');
    expect(started.status).toBe(202);
    expect(started.body).toEqual({ queued: 2 });
    const list = await json<{ items: Book[] }>(t.app, 'GET', '/api/books');
    expect(
      list.body.items
        .filter((b) => b.coverPending)
        .map((b) => b.title)
        .sort(),
    ).toEqual(['A', 'C']);
    await t.covers.service.idle();
    const status = await t.app.request('/api/covers/backfill');
    expect(status.headers.get('cache-control')).toBe('no-store');
    expect(await status.json()).toEqual({ queued: 2, pending: 0, done: 2, found: 1, failed: 0 });
    expect((await settled(a.id)).coverAssetId).toBeTruthy();
    expect((await settled(c.id)).coverAssetId).toBeNull();
    // Running it again only queues what is still open (C is a cached miss now).
    expect((await json<{ queued: number }>(t.app, 'POST', '/api/covers/backfill')).body).toEqual({
      queued: 0,
    });
  });
});
