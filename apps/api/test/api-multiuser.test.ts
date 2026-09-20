/**
 * Two real accounts side by side: each new one lands in its own "My Library /
 * Default", nothing of user A is reachable — by id or through a relation —
 * from user B's session, and deleting A takes everything of A and nothing of B.
 *
 * Sessions are real (`sessionAuth: true`): users come in through the
 * NODE_ENV=test sign-in seam exactly like the Playwright suite does, so the
 * provisioning that runs inside `resolveAccount` is what is under test.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  AuthMeResponse,
  Book,
  InventoryDefaults,
  LendingWithBook,
  Library,
  LibraryListResponse,
  Shelf,
  ShelfListResponse,
} from '@bookguardian/shared';
import { SESSION_COOKIE } from '../src/auth';
import { createRepositories } from '../src/db/repositories';
import { DEFAULT_LIBRARY_NAME, DEFAULT_SHELF_NAME, provisionUser } from '../src/provisioning';
import { createTestApp, json, type ErrorBody, type TestApp } from './app';
import { ISBN_WITH_COVER, photoJpeg } from './cover-fixtures';
import { parseSetCookies } from './google-fixtures';

interface Account {
  id: string;
  email: string;
  cookie: string;
}

/** Sign in through the test seam; a new email creates (and provisions) a user. */
async function signIn(t: TestApp, email: string, name = email.split('@')[0]): Promise<Account> {
  const res = await t.app.request('/api/auth/test-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  expect(res.status).toBe(200);
  const me = (await res.json()) as AuthMeResponse;
  const session = parseSetCookies(res)[SESSION_COOKIE];
  expect(session).toBeDefined();
  return { id: me.id, email: me.email!, cookie: `${SESSION_COOKIE}=${session!.value}` };
}

/** Everything user A owns, as user B will try to reach it. */
interface Fixture {
  library: Library;
  shelf: Shelf;
  otherShelf: Shelf;
  book: Book;
  lending: LendingWithBook;
  privateCoverAssetId: string;
  sharedCoverAssetId: string;
}

async function upload(t: TestApp, cookie: string, bookId: string, image: Buffer) {
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(image)], { type: 'image/jpeg' }), 'cover.jpg');
  const res = await t.app.request(`/api/books/${bookId}/cover`, {
    method: 'POST',
    body: form,
    headers: { cookie },
  });
  return { status: res.status, body: (await res.json()) as Book & ErrorBody };
}

/** A's world: a second library with two shelves, a book with a photo cover, an open lending, a shared cover. */
async function populate(t: TestApp, a: Account): Promise<Fixture> {
  const library = (
    await json<Library>(t.app, 'POST', '/api/libraries', { name: 'Attic' }, a.cookie)
  ).body;
  const shelf = (
    await json<Shelf>(
      t.app,
      'POST',
      '/api/shelves',
      { libraryId: library.id, name: 'Top' },
      a.cookie,
    )
  ).body;
  const otherShelf = (
    await json<Shelf>(
      t.app,
      'POST',
      '/api/shelves',
      { libraryId: library.id, name: 'Bottom' },
      a.cookie,
    )
  ).body;
  const book = (
    await json<Book>(t.app, 'POST', '/api/books', { title: 'Secret', shelfId: shelf.id }, a.cookie)
  ).body;
  const photo = await upload(t, a.cookie, book.id, await photoJpeg());
  expect(photo.status).toBe(200);
  const lending = (
    await json<LendingWithBook>(
      t.app,
      'POST',
      '/api/lendings',
      { bookId: book.id, borrowerName: 'Ana' },
      a.cookie,
    )
  ).body;
  const withIsbn = (
    await json<Book>(
      t.app,
      'POST',
      '/api/books',
      { title: 'Dune', isbn13: ISBN_WITH_COVER, shelfId: shelf.id },
      a.cookie,
    )
  ).body;
  await t.covers.service.idle();
  const shared = (await json<Book>(t.app, 'GET', `/api/books/${withIsbn.id}`, undefined, a.cookie))
    .body;
  expect(shared.coverAssetId).toBeTruthy();
  return {
    library,
    shelf,
    otherShelf,
    book,
    lending,
    privateCoverAssetId: photo.body.coverAssetId!,
    sharedCoverAssetId: shared.coverAssetId!,
  };
}

describe('multi-user', () => {
  let t: TestApp;
  let a: Account;
  let b: Account;
  beforeEach(async () => {
    t = await createTestApp({ sessionAuth: true, covers: { apiKey: 'k' } });
    // The very first sign-in claims the seeded local user (and its library);
    // every later one is a brand-new account.
    a = await signIn(t, 'a@example.test', 'A');
    b = await signIn(t, 'b@example.test', 'B');
  });
  afterEach(async () => {
    await t.cleanup();
  });

  describe('provisioning', () => {
    it('gives a brand-new account "My Library" with a "Default" shelf and working defaults', async () => {
      expect(b.id).not.toBe(t.base.userId);
      const libraries = await json<LibraryListResponse>(
        t.app,
        'GET',
        '/api/libraries',
        undefined,
        b.cookie,
      );
      expect(libraries.status).toBe(200);
      expect(libraries.body.items).toHaveLength(1);
      expect(libraries.body.items[0]).toMatchObject({
        name: DEFAULT_LIBRARY_NAME,
        ownerId: b.id,
        shelfCount: 1,
        bookCount: 0,
      });
      const libraryId = libraries.body.items[0]!.id;

      const shelves = await json<ShelfListResponse>(
        t.app,
        'GET',
        `/api/shelves?libraryId=${libraryId}`,
        undefined,
        b.cookie,
      );
      expect(shelves.body.items.map((s) => s.name)).toEqual([DEFAULT_SHELF_NAME]);

      const defaults = await json<InventoryDefaults>(
        t.app,
        'GET',
        '/api/defaults',
        undefined,
        b.cookie,
      );
      expect(defaults.status).toBe(200);
      expect(defaults.body).toEqual({ libraryId, shelfId: shelves.body.items[0]!.id });

      // Title-only add lands on that shelf.
      const created = await json<Book>(t.app, 'POST', '/api/books', { title: 'First' }, b.cookie);
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ ownerId: b.id, shelfId: defaults.body.shelfId });
    });

    it('keeps the claimed local user on its seeded library instead of adding another', async () => {
      expect(a.id).toBe(t.base.userId);
      const libraries = await json<LibraryListResponse>(
        t.app,
        'GET',
        '/api/libraries',
        undefined,
        a.cookie,
      );
      expect(libraries.body.items.map((l) => l.id)).toEqual([t.base.libraryId]);
    });

    it('is idempotent: signing in again, or provisioning twice, never duplicates', async () => {
      await signIn(t, 'b@example.test', 'B');
      await signIn(t, 'B@Example.test', 'B again');
      const repos = createRepositories(t.db.adapter);
      expect(await repos.libraries.listByOwner(b.id)).toHaveLength(1);

      const again = await provisionUser(repos, b.id);
      expect(again.created).toBe(false);
      expect(await repos.libraries.listByOwner(b.id)).toHaveLength(1);
      expect(await repos.shelves.listByOwner(b.id)).toHaveLength(1);

      // A user renamed / rearranged their library: still nothing is added.
      await json(t.app, 'PATCH', `/api/libraries/${again.libraryId}`, { name: 'Casa' }, b.cookie);
      await signIn(t, 'b@example.test', 'B');
      expect((await repos.libraries.listByOwner(b.id)).map((l) => l.name)).toEqual(['Casa']);
    });

    it('defaults follow each user separately', async () => {
      const c = await signIn(t, 'c@example.test');
      const forB = await json<InventoryDefaults>(
        t.app,
        'GET',
        '/api/defaults',
        undefined,
        b.cookie,
      );
      const forC = await json<InventoryDefaults>(
        t.app,
        'GET',
        '/api/defaults',
        undefined,
        c.cookie,
      );
      expect(forB.body.libraryId).not.toBe(forC.body.libraryId);
      expect(forB.body.shelfId).not.toBe(forC.body.shelfId);
      const repos = createRepositories(t.db.adapter);
      expect((await repos.shelves.findById(c.id, forC.body.shelfId))?.ownerId).toBe(c.id);
    });
  });

  describe('isolation: user B against user A’s resources', () => {
    let f: Fixture;
    let bDefaults: InventoryDefaults;
    let bShelf: string;
    let bBook: Book;
    beforeEach(async () => {
      f = await populate(t, a);
      bDefaults = (
        await json<InventoryDefaults>(t.app, 'GET', '/api/defaults', undefined, b.cookie)
      ).body;
      bShelf = bDefaults.shelfId;
      bBook = (await json<Book>(t.app, 'POST', '/api/books', { title: 'Mine' }, b.cookie)).body;
    });

    /** `[label, method, path(), body?, expected status, expected code]` */
    type Case = [
      label: string,
      method: string,
      path: () => string,
      body: (() => unknown) | undefined,
      status: number,
      code: string,
    ];

    const cases: Case[] = [
      [
        'GET library by id',
        'GET',
        () => `/api/libraries/${f.library.id}`,
        undefined,
        404,
        'not_found',
      ],
      [
        'PATCH library',
        'PATCH',
        () => `/api/libraries/${f.library.id}`,
        () => ({ name: 'Pwned' }),
        404,
        'not_found',
      ],
      [
        'DELETE library',
        'DELETE',
        () => `/api/libraries/${f.library.id}`,
        undefined,
        404,
        'not_found',
      ],
      [
        'GET shelves of library',
        'GET',
        () => `/api/shelves?libraryId=${f.library.id}`,
        undefined,
        404,
        'not_found',
      ],
      [
        'POST shelf into library',
        'POST',
        () => '/api/shelves',
        () => ({ libraryId: f.library.id, name: 'X' }),
        422,
        'unknown_library',
      ],
      [
        'POST reorder shelves of library',
        'POST',
        () => '/api/shelves/reorder',
        () => ({ libraryId: f.library.id, shelfIds: [f.otherShelf.id, f.shelf.id] }),
        422,
        'shelf_mismatch',
      ],
      ['GET shelf by id', 'GET', () => `/api/shelves/${f.shelf.id}`, undefined, 404, 'not_found'],
      [
        'PATCH shelf',
        'PATCH',
        () => `/api/shelves/${f.shelf.id}`,
        () => ({ name: 'Pwned' }),
        404,
        'not_found',
      ],
      [
        'DELETE shelf',
        'DELETE',
        () => `/api/shelves/${f.otherShelf.id}`,
        undefined,
        404,
        'not_found',
      ],
      [
        'POST book into shelf',
        'POST',
        () => '/api/books',
        () => ({ title: 'Intruder', shelfId: f.shelf.id }),
        422,
        'unknown_shelf',
      ],
      ['GET book by id', 'GET', () => `/api/books/${f.book.id}`, undefined, 404, 'not_found'],
      [
        'PATCH book',
        'PATCH',
        () => `/api/books/${f.book.id}`,
        () => ({ title: 'Pwned' }),
        404,
        'not_found',
      ],
      [
        'PATCH own book onto shelf',
        'PATCH',
        () => `/api/books/${bBook.id}`,
        () => ({ shelfId: f.shelf.id }),
        422,
        'unknown_shelf',
      ],
      [
        'POST move book (to own shelf)',
        'POST',
        () => `/api/books/${f.book.id}/move`,
        () => ({ shelfId: bShelf }),
        404,
        'not_found',
      ],
      [
        'POST move own book to shelf',
        'POST',
        () => `/api/books/${bBook.id}/move`,
        () => ({ shelfId: f.shelf.id }),
        422,
        'unknown_shelf',
      ],
      [
        'GET book lendings',
        'GET',
        () => `/api/books/${f.book.id}/lendings`,
        undefined,
        404,
        'not_found',
      ],
      ['DELETE book', 'DELETE', () => `/api/books/${f.book.id}`, undefined, 404, 'not_found'],
      [
        'DELETE book cover',
        'DELETE',
        () => `/api/books/${f.book.id}/cover`,
        undefined,
        404,
        'not_found',
      ],
      [
        'POST lending of book',
        'POST',
        () => '/api/lendings',
        () => ({ bookId: f.book.id, borrowerName: 'Eve' }),
        422,
        'unknown_book',
      ],
      [
        'GET lendings of book',
        'GET',
        () => `/api/lendings?bookId=${f.book.id}`,
        undefined,
        404,
        'not_found',
      ],
      [
        'GET lending by id',
        'GET',
        () => `/api/lendings/${f.lending.id}`,
        undefined,
        404,
        'not_found',
      ],
      [
        'POST return lending',
        'POST',
        () => `/api/lendings/${f.lending.id}/return`,
        () => ({}),
        404,
        'not_found',
      ],
      [
        'GET private cover file',
        'GET',
        () => `/api/covers/${f.privateCoverAssetId}.webp`,
        undefined,
        404,
        'not_found',
      ],
      [
        'GET private cover thumb',
        'GET',
        () => `/api/covers/${f.privateCoverAssetId}-thumb.webp`,
        undefined,
        404,
        'not_found',
      ],
    ];

    it.each(cases)('%s → %i %s', async (_label, method, path, body, status, code) => {
      const res = await json<ErrorBody>(t.app, method, path(), body?.(), b.cookie);
      expect(res.status).toBe(status);
      expect(res.body.error.code).toBe(code);
    });

    it('POST cover upload on a foreign book → 404', async () => {
      const res = await upload(t, b.cookie, f.book.id, await photoJpeg());
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('not_found');
    });

    it('DELETE own shelf moving books to a foreign shelf → 422', async () => {
      const second = (
        await json<Shelf>(
          t.app,
          'POST',
          '/api/shelves',
          { libraryId: bDefaults.libraryId, name: 'Two' },
          b.cookie,
        )
      ).body;
      await json(t.app, 'POST', '/api/books', { title: 'On two', shelfId: second.id }, b.cookie);
      const res = await json<ErrorBody>(
        t.app,
        'DELETE',
        `/api/shelves/${second.id}?moveBooksTo=${f.shelf.id}`,
        undefined,
        b.cookie,
      );
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('unknown_shelf');
    });

    it('listings filtered by a foreign container are empty, never A’s rows', async () => {
      const byShelf = await json<{ items: Book[]; total: number }>(
        t.app,
        'GET',
        `/api/books?shelfId=${f.shelf.id}`,
        undefined,
        b.cookie,
      );
      expect(byShelf.status).toBe(200);
      expect(byShelf.body).toMatchObject({ items: [], total: 0 });
      const byLibrary = await json<{ items: Book[]; total: number }>(
        t.app,
        'GET',
        `/api/books?libraryId=${f.library.id}`,
        undefined,
        b.cookie,
      );
      expect(byLibrary.body).toMatchObject({ items: [], total: 0 });

      const all = await json<{ items: Book[] }>(t.app, 'GET', '/api/books', undefined, b.cookie);
      expect(all.body.items.map((x) => x.id)).toEqual([bBook.id]);
      const lendings = await json<{ items: LendingWithBook[] }>(
        t.app,
        'GET',
        '/api/lendings',
        undefined,
        b.cookie,
      );
      expect(lendings.body.items).toEqual([]);
      const borrowers = await json<{ items: unknown[] }>(
        t.app,
        'GET',
        '/api/lendings/borrowers',
        undefined,
        b.cookie,
      );
      expect(borrowers.body.items).toEqual([]);
      const libraries = await json<LibraryListResponse>(
        t.app,
        'GET',
        '/api/libraries',
        undefined,
        b.cookie,
      );
      expect(libraries.body.items.every((l) => l.ownerId === b.id)).toBe(true);
      const shelves = await json<ShelfListResponse>(
        t.app,
        'GET',
        '/api/shelves',
        undefined,
        b.cookie,
      );
      expect(shelves.body.items.every((s) => s.ownerId === b.id)).toBe(true);
    });

    it('shared covers (resolved by ISBN) are served to everyone; the ISBN cache is reused', async () => {
      const res = await t.app.request(`/api/covers/${f.sharedCoverAssetId}.webp`, {
        headers: { cookie: b.cookie },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toContain('public');

      const calls = t.covers.fetch.calls.length;
      const mine = await json<Book>(
        t.app,
        'POST',
        '/api/books',
        { title: 'Dune too', isbn13: ISBN_WITH_COVER },
        b.cookie,
      );
      await t.covers.service.idle();
      const settled = await json<Book>(
        t.app,
        'GET',
        `/api/books/${mine.body.id}`,
        undefined,
        b.cookie,
      );
      expect(settled.body.coverAssetId).toBe(f.sharedCoverAssetId);
      expect(t.covers.fetch.calls.length).toBe(calls);
    });

    it('leaves A’s data exactly as it was after every attempt', async () => {
      for (const [, method, path, body] of cases) {
        await json(t.app, method, path(), body?.(), b.cookie);
      }
      await upload(t, b.cookie, f.book.id, await photoJpeg());

      const library = await json<Library>(
        t.app,
        'GET',
        `/api/libraries/${f.library.id}`,
        undefined,
        a.cookie,
      );
      expect(library.body).toMatchObject({ name: 'Attic', shelfCount: 2, bookCount: 2 });
      const shelves = await json<ShelfListResponse>(
        t.app,
        'GET',
        `/api/shelves?libraryId=${f.library.id}`,
        undefined,
        a.cookie,
      );
      expect(shelves.body.items.map((s) => s.name)).toEqual(['Top', 'Bottom']);
      const book = await json<Book>(t.app, 'GET', `/api/books/${f.book.id}`, undefined, a.cookie);
      expect(book.body).toMatchObject({
        title: 'Secret',
        shelfId: f.shelf.id,
        coverAssetId: f.privateCoverAssetId,
        coverOverride: true,
      });
      const lending = await json<LendingWithBook>(
        t.app,
        'GET',
        `/api/lendings/${f.lending.id}`,
        undefined,
        a.cookie,
      );
      expect(lending.body).toMatchObject({ borrowerName: 'Ana', returnedAt: null });
      const cover = await t.app.request(`/api/covers/${f.privateCoverAssetId}.webp`, {
        headers: { cookie: a.cookie },
      });
      expect(cover.status).toBe(200);
    });

    it('library_shares grants nothing today: no route writes it and B stays locked out', async () => {
      const repos = createRepositories(t.db.adapter);
      expect(await repos.libraryShares.listByGrantee(b.id)).toEqual([]);
      expect(await repos.libraryShares.listByLibrary(f.library.id)).toEqual([]);
      // No API route mounts a way to create a share.
      const res = await json<ErrorBody>(
        t.app,
        'POST',
        `/api/libraries/${f.library.id}/shares`,
        { granteeId: b.id },
        a.cookie,
      );
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/auth/me', () => {
    it('requires a session and the account email typed back', async () => {
      const anonymous = await json<ErrorBody>(t.app, 'DELETE', '/api/auth/me', {
        confirmEmail: a.email,
      });
      expect(anonymous.status).toBe(401);

      const missing = await json<ErrorBody>(t.app, 'DELETE', '/api/auth/me', {}, a.cookie);
      expect(missing.status).toBe(422);
      expect(missing.body.error.code).toBe('validation_error');

      const wrong = await json<ErrorBody>(
        t.app,
        'DELETE',
        '/api/auth/me',
        { confirmEmail: b.email },
        a.cookie,
      );
      expect(wrong.status).toBe(422);
      expect(wrong.body.error.code).toBe('confirm_email_mismatch');

      // Nothing happened: A is still signed in with their data.
      const me = await json<AuthMeResponse>(t.app, 'GET', '/api/auth/me', undefined, a.cookie);
      expect(me.status).toBe(200);
      expect(me.body.id).toBe(a.id);
    });

    it('refuses for a session whose user has no email (unclaimed local user)', async () => {
      const fresh = await createTestApp({ sessionAuth: true });
      try {
        const local = await fresh.loginAs(fresh.base.userId);
        const res = await json<ErrorBody>(
          fresh.app,
          'DELETE',
          '/api/auth/me',
          { confirmEmail: 'whoever@example.test' },
          local.cookie,
        );
        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe('confirm_email_mismatch');
        expect(await fresh.repos.users.findById(fresh.base.userId)).not.toBeNull();
      } finally {
        await fresh.cleanup();
      }
    });

    it('cascades through everything A owns, keeps shared covers, and leaves B signed in', async () => {
      const f = await populate(t, a);
      const bBook = (await json<Book>(t.app, 'POST', '/api/books', { title: 'Mine' }, b.cookie))
        .body;
      const aSecondSession = await t.loginAs(a.id);
      const repos = createRepositories(t.db.adapter);
      expect(await repos.sessions.listByUser(a.id)).toHaveLength(2);
      expect(await repos.authIdentities.listByUser(a.id)).toHaveLength(1);
      expect(await t.covers.service.readFile(f.privateCoverAssetId, 'full')).not.toBeNull();

      const res = await t.app.request('/api/auth/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', cookie: a.cookie },
        // Case and whitespace do not matter: the same person typed it.
        body: JSON.stringify({ confirmEmail: ` ${a.email.toUpperCase()} ` }),
      });
      expect(res.status).toBe(204);
      const cleared = parseSetCookies(res)[SESSION_COOKIE];
      expect(cleared?.attrs['max-age']).toBe('0');

      // The user and every owned row are gone.
      expect(await repos.users.findById(a.id)).toBeNull();
      expect(await repos.sessions.listByUser(a.id)).toEqual([]);
      expect(await repos.authIdentities.listByUser(a.id)).toEqual([]);
      expect(await repos.libraries.listByOwner(a.id)).toEqual([]);
      expect(await repos.shelves.listByOwner(a.id)).toEqual([]);
      expect(await repos.books.listByOwner(a.id)).toEqual([]);
      expect(await repos.lendings.list(a.id)).toEqual([]);
      expect(await repos.users.findByEmail(a.email)).toBeNull();

      // Both of A's sessions are dead.
      expect((await json(t.app, 'GET', '/api/auth/me', undefined, a.cookie)).status).toBe(401);
      expect(
        (await json(t.app, 'GET', '/api/libraries', undefined, aSecondSession.cookie)).status,
      ).toBe(401);

      // Private cover: row and files gone. Shared cover: untouched, still served.
      expect(await repos.coverAssets.find(f.privateCoverAssetId)).toBeNull();
      expect(await t.covers.service.readFile(f.privateCoverAssetId, 'full')).toBeNull();
      expect(await t.covers.service.readFile(f.privateCoverAssetId, 'thumb')).toBeNull();
      expect(await repos.coverAssets.find(f.sharedCoverAssetId)).not.toBeNull();
      expect(await t.covers.service.readFile(f.sharedCoverAssetId, 'full')).not.toBeNull();
      expect((await repos.isbnCovers.find(ISBN_WITH_COVER))?.coverAssetId).toBe(
        f.sharedCoverAssetId,
      );
      const shared = await t.app.request(`/api/covers/${f.sharedCoverAssetId}.webp`, {
        headers: { cookie: b.cookie },
      });
      expect(shared.status).toBe(200);

      // B is untouched and still signed in.
      const me = await json<AuthMeResponse>(t.app, 'GET', '/api/auth/me', undefined, b.cookie);
      expect(me.status).toBe(200);
      expect(me.body.id).toBe(b.id);
      const books = await json<{ items: Book[] }>(t.app, 'GET', '/api/books', undefined, b.cookie);
      expect(books.body.items.map((x) => x.id)).toEqual([bBook.id]);
      expect(await repos.libraries.listByOwner(b.id)).toHaveLength(1);

      // Signing in again with A's email is a brand-new, freshly provisioned account.
      const reborn = await signIn(t, a.email, 'A');
      expect(reborn.id).not.toBe(a.id);
      const libraries = await json<LibraryListResponse>(
        t.app,
        'GET',
        '/api/libraries',
        undefined,
        reborn.cookie,
      );
      expect(libraries.body.items).toHaveLength(1);
      expect(libraries.body.items[0]).toMatchObject({ name: DEFAULT_LIBRARY_NAME, bookCount: 0 });
    });
  });
});
