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
