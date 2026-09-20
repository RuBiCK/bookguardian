import { localDate, type Book, type Borrower, type LendingWithBook } from '@bookguardian/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, json, MISSING_ID, type ErrorBody, type TestApp } from './app';

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** A calendar day `days` from today, as YYYY-MM-DD (local). */
function dayFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
}

describe('/api/lendings', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(async () => {
    await t.cleanup();
  });

  const addBook = async (title: string, extra: Record<string, unknown> = {}) =>
    (await json<Book>(t.app, 'POST', '/api/books', { title, ...extra })).body;
  const lend = (body: Record<string, unknown>) =>
    json<LendingWithBook>(t.app, 'POST', '/api/lendings', body);
  const active = async () =>
    (await json<{ items: LendingWithBook[] }>(t.app, 'GET', '/api/lendings')).body.items;

  it('lends a book: lent now, no due date, book summary attached', async () => {
    const book = await addBook('Dune', { authors: ['Frank Herbert'] });
    // A cover the cascade would have stored, so the row carries its served URL.
    const asset = await t.repos.coverAssets.upsert({
      id: 'a'.repeat(64),
      width: 400,
      height: 600,
      bytes: 1000,
      source: 'open_library',
      ownerId: null,
    });
    await t.repos.books.setCover(t.base.userId, book.id, asset.id, false);
    const res = await lend({ bookId: book.id, borrowerName: '  Ana  ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      bookId: book.id,
      ownerId: t.base.userId,
      borrowerName: 'Ana',
      borrowerContact: null,
      dueAt: null,
      returnedAt: null,
      overdue: false,
      book: {
        id: book.id,
        title: 'Dune',
        authors: ['Frank Herbert'],
        coverAssetId: 'a'.repeat(64),
        coverUrl: `/api/covers/${'a'.repeat(64)}.webp`,
        shelfId: t.base.shelfId,
      },
    });
    expect(res.body.lentAt).toMatch(ISO_RE);

    const got = await json<LendingWithBook>(t.app, 'GET', `/api/lendings/${res.body.id}`);
    expect(got.status).toBe(200);
    expect(got.body).toEqual(res.body);
    expect(await active()).toEqual([res.body]);
  });

  it('a book has at most one active lending', async () => {
    const book = await addBook('Dune');
    const first = await lend({ bookId: book.id, borrowerName: 'Ana' });
    expect(first.status).toBe(201);

    const again = await json<ErrorBody>(t.app, 'POST', '/api/lendings', {
      bookId: book.id,
      borrowerName: 'Bo',
    });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('already_lent');
    expect(again.body.error.details).toEqual({ lendingId: first.body.id, borrowerName: 'Ana' });
    expect(await active()).toHaveLength(1);

    // Once it is back, it can go out again — to anyone.
    const returned = await json<LendingWithBook>(
      t.app,
      'POST',
      `/api/lendings/${first.body.id}/return`,
      {},
    );
    expect(returned.status).toBe(200);
    expect(returned.body.returnedAt).toMatch(ISO_RE);
    const second = await lend({ bookId: book.id, borrowerName: 'Bo' });
    expect(second.status).toBe(201);
    expect((await active()).map((l) => l.borrowerName)).toEqual(['Bo']);

    // Two different books can be out at the same time, of course.
    const other = await addBook('Emma');
    expect((await lend({ bookId: other.id, borrowerName: 'Bo' })).status).toBe(201);
    expect(await active()).toHaveLength(2);
  });

  it('returning: stamps now or the given time, only once, never before the lending', async () => {
    const book = await addBook('Dune');
    const lending = (
      await lend({ bookId: book.id, borrowerName: 'Ana', lentAt: '2026-01-10T10:00:00.000Z' })
    ).body;

    const early = await json<ErrorBody>(t.app, 'POST', `/api/lendings/${lending.id}/return`, {
      returnedAt: '2026-01-09T00:00:00.000Z',
    });
    expect(early.status).toBe(422);
    expect(early.body.error.code).toBe('returned_before_lent');

    const badBody = await json<ErrorBody>(t.app, 'POST', `/api/lendings/${lending.id}/return`, {
      returnedAt: 'yesterday',
    });
    expect(badBody.status).toBe(422);
    expect(badBody.body.error.code).toBe('validation_error');

    const returned = await json<LendingWithBook>(
      t.app,
      'POST',
      `/api/lendings/${lending.id}/return`,
      { returnedAt: '2026-02-01T12:00:00.000Z' },
    );
    expect(returned.status).toBe(200);
    expect(returned.body.returnedAt).toBe('2026-02-01T12:00:00.000Z');
    expect(returned.body.overdue).toBe(false);
    expect(await active()).toEqual([]);

    const twice = await json<ErrorBody>(t.app, 'POST', `/api/lendings/${lending.id}/return`, {});
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe('already_returned');
    expect(twice.body.error.details).toEqual({ returnedAt: '2026-02-01T12:00:00.000Z' });

    const missing = await json<ErrorBody>(t.app, 'POST', `/api/lendings/${MISSING_ID}/return`, {});
    expect(missing.status).toBe(404);
    const missingGet = await json<ErrorBody>(t.app, 'GET', `/api/lendings/${MISSING_ID}`);
    expect(missingGet.status).toBe(404);
  });

  it('computes overdue from the due day: yesterday is overdue, today and tomorrow are not', async () => {
    const late = await addBook('Late');
    const dueToday = await addBook('Due today');
    const soon = await addBook('Soon');
    const open = await addBook('Open-ended');
    // Explicit, increasing lentAt: four lends in the same millisecond would tie on "newest first".
    const at = (i: number) => new Date(Date.now() - (4 - i) * 60_000).toISOString();
    const l1 = (
      await lend({ bookId: late.id, borrowerName: 'Ana', dueAt: dayFromToday(-1), lentAt: at(1) })
    ).body;
    const l2 = (
      await lend({
        bookId: dueToday.id,
        borrowerName: 'Ana',
        dueAt: dayFromToday(0),
        lentAt: at(2),
      })
    ).body;
    const l3 = (
      await lend({ bookId: soon.id, borrowerName: 'Bo', dueAt: dayFromToday(1), lentAt: at(3) })
    ).body;
    const l4 = (await lend({ bookId: open.id, borrowerName: 'Bo', lentAt: at(4) })).body;
    expect([l1.overdue, l2.overdue, l3.overdue, l4.overdue]).toEqual([true, false, false, false]);

    // Newest first: the last lending comes first.
    const all = await active();
    expect(all.map((l) => l.book.title)).toEqual(['Open-ended', 'Soon', 'Due today', 'Late']);
    expect(all.map((l) => l.overdue)).toEqual([false, false, false, true]);

    const overdue = await json<{ items: LendingWithBook[] }>(
      t.app,
      'GET',
      '/api/lendings?overdue=true',
    );
    expect(overdue.body.items.map((l) => l.id)).toEqual([l1.id]);

    // Returned lendings are never overdue, even long past their due day.
    await json(t.app, 'POST', `/api/lendings/${l1.id}/return`, {});
    expect(
      (await json<{ items: LendingWithBook[] }>(t.app, 'GET', '/api/lendings?overdue=true')).body
        .items,
    ).toEqual([]);
    const history = await json<{ items: LendingWithBook[] }>(
      t.app,
      'GET',
      '/api/lendings?active=false',
    );
    expect(history.body.items.map((l) => l.id)).toEqual([l1.id]);
    expect(history.body.items[0]!.overdue).toBe(false);
  });

  it('keeps the lending history per book, newest first', async () => {
    const book = await addBook('Dune');
    const other = await addBook('Emma');
    const first = (
      await lend({ bookId: book.id, borrowerName: 'Ana', lentAt: '2026-01-01T00:00:00.000Z' })
    ).body;
    await json(t.app, 'POST', `/api/lendings/${first.id}/return`, {
      returnedAt: '2026-01-20T00:00:00.000Z',
    });
    const second = (
      await lend({ bookId: book.id, borrowerName: 'Bo', lentAt: '2026-03-01T00:00:00.000Z' })
    ).body;
    await lend({ bookId: other.id, borrowerName: 'Cy' });

    const history = await json<{ items: LendingWithBook[] }>(
      t.app,
      'GET',
      `/api/books/${book.id}/lendings`,
    );
    expect(history.status).toBe(200);
    expect(history.body.items.map((l) => [l.id, l.borrowerName, l.returnedAt])).toEqual([
      [second.id, 'Bo', null],
      [first.id, 'Ana', '2026-01-20T00:00:00.000Z'],
    ]);
    // Same thing through the query flag.
    const viaQuery = await json<{ items: LendingWithBook[] }>(
      t.app,
      'GET',
      `/api/lendings?active=false&bookId=${book.id}`,
    );
    expect(viaQuery.body.items.map((l) => l.id)).toEqual([first.id]);

    const missing = await json<ErrorBody>(t.app, 'GET', `/api/books/${MISSING_ID}/lendings`);
    expect(missing.status).toBe(404);
  });

  it('lists previous borrowers, most recent first, folding name case', async () => {
    const a = await addBook('A');
    const b = await addBook('B');
    const c = await addBook('C');
    await lend({
      bookId: a.id,
      borrowerName: 'Ana',
      borrowerContact: 'ana@example.com',
      lentAt: '2026-01-01T00:00:00.000Z',
    });
    await lend({ bookId: b.id, borrowerName: 'Bo', lentAt: '2026-02-01T00:00:00.000Z' });
    await lend({
      bookId: c.id,
      borrowerName: 'ana',
      borrowerContact: '+34 600',
      lentAt: '2026-03-01T00:00:00.000Z',
    });

    const res = await json<{ items: Borrower[] }>(t.app, 'GET', '/api/lendings/borrowers');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      { name: 'ana', contact: '+34 600', lastLentAt: '2026-03-01T00:00:00.000Z' },
      { name: 'Bo', contact: null, lastLentAt: '2026-02-01T00:00:00.000Z' },
    ]);
  });

  it('validates input and refuses unknown books', async () => {
    const book = await addBook('Dune');
    for (const bad of [
      {},
      { borrowerName: 'Ana' },
      { bookId: book.id },
      { bookId: book.id, borrowerName: '   ' },
      { bookId: book.id, borrowerName: 'Ana', dueAt: '2026-1-1' },
      { bookId: book.id, borrowerName: 'Ana', lentAt: '2026-01-01' },
      { bookId: 'nope', borrowerName: 'Ana' },
    ]) {
      const res = await json<ErrorBody>(t.app, 'POST', '/api/lendings', bad);
      expect(res.status, JSON.stringify(bad)).toBe(422);
      expect(res.body.error.code).toBe('validation_error');
    }
    const unknown = await json<ErrorBody>(t.app, 'POST', '/api/lendings', {
      bookId: MISSING_ID,
      borrowerName: 'Ana',
    });
    expect(unknown.status).toBe(422);
    expect(unknown.body.error.code).toBe('unknown_book');

    const badQuery = await json<ErrorBody>(t.app, 'GET', '/api/lendings?active=maybe');
    expect(badQuery.status).toBe(422);
  });

  it('deleting a book takes its lendings with it', async () => {
    const book = await addBook('Dune');
    const lending = (await lend({ bookId: book.id, borrowerName: 'Ana' })).body;
    expect(await active()).toHaveLength(1);
    expect((await json(t.app, 'DELETE', `/api/books/${book.id}`)).status).toBe(204);
    expect(await active()).toEqual([]);
    expect((await json(t.app, 'GET', `/api/lendings/${lending.id}`)).status).toBe(404);
  });
});
