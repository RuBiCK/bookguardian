import type { BookDraft, LookupSearchResponse } from '@bookguardian/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, json, type ErrorBody, type TestApp } from './app';
import { OPEN_LIBRARY } from './lookup-fixtures';

describe('/api/lookup', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(async () => {
    await t.cleanup();
  });

  it('resolves an ISBN in any written form to a draft', async () => {
    const res = await json<BookDraft>(t.app, 'GET', '/api/lookup/isbn/0-441-17271-7');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      isbn13: '9780441172719',
      isbn10: '0441172717',
      title: 'Dune',
      authors: ['Frank Herbert'],
      source: 'open_library',
    });
    const raw = await t.app.request('/api/lookup/isbn/9780441172719');
    expect(raw.headers.get('cache-control')).toBe('private, max-age=86400');
  });

  it('rejects malformed ISBNs and reports unknown ones', async () => {
    const bad = await json<ErrorBody>(t.app, 'GET', '/api/lookup/isbn/1234567890123');
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('validation_error');

    const missing = await json<ErrorBody>(t.app, 'GET', '/api/lookup/isbn/9780000000002');
    expect(missing.status).toBe(404);
    expect(missing.body.error).toMatchObject({
      code: 'isbn_not_found',
      details: { isbn: '9780000000002' },
    });
  });

  it('searches free text with a bounded limit', async () => {
    const res = await json<LookupSearchResponse>(
      t.app,
      'GET',
      '/api/lookup/search?q=Dune%20Frank%20Herbert&limit=2',
    );
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ title: 'Dune', source: 'open_library' });

    expect((await json(t.app, 'GET', '/api/lookup/search?q=d')).status).toBe(422);
    expect((await json(t.app, 'GET', '/api/lookup/search')).status).toBe(422);
    expect((await json(t.app, 'GET', '/api/lookup/search?q=dune&limit=99')).status).toBe(422);
  });

  it('answers 503 when every provider is down', async () => {
    t.lookup.fetch.route(() => ({ status: 500, body: {} }));
    const res = await json<ErrorBody>(t.app, 'GET', '/api/lookup/isbn/9780441172719');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('lookup_unavailable');
    expect(res.body.error.details).toEqual({
      providers: [
        { provider: 'open_library', message: 'open_library: HTTP 500' },
        { provider: 'google_books', message: 'google_books: HTTP 500' },
      ],
    });
    const search = await json<ErrorBody>(t.app, 'GET', '/api/lookup/search?q=dune');
    expect(search.status).toBe(503);
  });

  it('keeps Open Library ahead of Google and only falls back on a miss', async () => {
    const res = await json<BookDraft>(t.app, 'GET', '/api/lookup/isbn/9780441013593');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('google_books');
    expect(t.lookup.fetch.calls[0]).toBe(`${OPEN_LIBRARY}/isbn/9780441013593.json`);
  });
});

describe('/api/lookup with the shared catalogue', () => {
  const T0 = Date.parse('2026-09-19T12:00:00.000Z');
  const DAY = 24 * 60 * 60 * 1000;
  let nowMs: number;
  let t: TestApp;
  const providerCalls = (app: TestApp) => app.lookup.fetch.calls.length;

  beforeEach(async () => {
    nowMs = T0;
    t = await createTestApp({
      lookup: { now: () => nowMs, refreshMs: 180 * DAY, missMs: 7 * DAY },
    });
  });
  afterEach(async () => {
    await t.cleanup();
  });

  it('fetches an ISBN once and survives an app restart on the same database', async () => {
    const first = await json<BookDraft>(t.app, 'GET', '/api/lookup/isbn/9780441172719');
    expect(first.status).toBe(200);
    const afterFirst = providerCalls(t);
    expect(afterFirst).toBeGreaterThan(0);

    const second = await json<BookDraft>(t.app, 'GET', '/api/lookup/isbn/9780441172719');
    expect(second.body).toEqual(first.body);
    expect(providerCalls(t)).toBe(afterFirst);

    // New app instance, new (empty) provider stub, same SQLite file.
    const restarted = await createTestApp({ db: t.db, lookup: { now: () => nowMs } });
    const third = await json<BookDraft>(restarted.app, 'GET', '/api/lookup/isbn/9780441172719');
    expect(third.body).toEqual(first.body);
    expect(providerCalls(restarted)).toBe(0);
    expect(await restarted.repos.catalogBooks.count()).toBe(1);
  });

  it('answers an ISBN-10 from the row its ISBN-13 created', async () => {
    await json<BookDraft>(t.app, 'GET', '/api/lookup/isbn/9780441172719');
    const calls = providerCalls(t);
    const res = await json<BookDraft>(t.app, 'GET', '/api/lookup/isbn/0-441-17271-7');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isbn13: '9780441172719', isbn10: '0441172717' });
    expect(providerCalls(t)).toBe(calls);
    expect(await t.repos.catalogBooks.count()).toBe(1);
  });

  it('remembers unknown ISBNs and retries once miss_until has passed', async () => {
    const miss = await json<ErrorBody>(t.app, 'GET', '/api/lookup/isbn/9780000000002');
    expect(miss.status).toBe(404);
    const calls = providerCalls(t);

    nowMs = T0 + 3 * DAY;
    expect((await json(t.app, 'GET', '/api/lookup/isbn/9780000000002')).status).toBe(404);
    expect(providerCalls(t)).toBe(calls);

    nowMs = T0 + 8 * DAY;
    expect((await json(t.app, 'GET', '/api/lookup/isbn/9780000000002')).status).toBe(404);
    expect(providerCalls(t)).toBeGreaterThan(calls);
  });

  it('serves a stale row at once and refreshes it behind the reply', async () => {
    await json<BookDraft>(t.app, 'GET', '/api/lookup/isbn/9780441172719');
    const calls = providerCalls(t);
    nowMs = T0 + 200 * DAY;
    t.lookup.fetch.route((url) =>
      url.pathname === '/isbn/9780441172719.json'
        ? { status: 200, body: { title: 'Dune (2nd ed.)', isbn_13: ['9780441172719'] } }
        : undefined,
    );
    const stale = await json<BookDraft>(t.app, 'GET', '/api/lookup/isbn/9780441172719');
    expect(stale.body.title).toBe('Dune');
    await t.lookup.service.idle();
    expect(providerCalls(t)).toBe(calls + 1);
    const fresh = await json<BookDraft>(t.app, 'GET', '/api/lookup/isbn/9780441172719');
    expect(fresh.body.title).toBe('Dune (2nd ed.)');
    expect(providerCalls(t)).toBe(calls + 1);
  });

  it('shares one provider round-trip between concurrent scans of the same book', async () => {
    const replies = await Promise.all(
      Array.from({ length: 3 }, () =>
        json<BookDraft>(t.app, 'GET', '/api/lookup/isbn/9780441172719'),
      ),
    );
    expect(replies.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(t.lookup.fetch.calls.filter((c) => c.includes('/isbn/'))).toHaveLength(1);
  });

  it('fills the catalogue from search results so tapping a candidate is free', async () => {
    const search = await json<LookupSearchResponse>(
      t.app,
      'GET',
      '/api/lookup/search?q=dune&limit=5',
    );
    const candidate = search.body.items.find((i) => i.isbn13)!;
    expect(candidate).toBeDefined();
    const calls = providerCalls(t);
    const res = await json<BookDraft>(t.app, 'GET', `/api/lookup/isbn/${candidate.isbn13}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(candidate);
    expect(providerCalls(t)).toBe(calls);
  });
});
