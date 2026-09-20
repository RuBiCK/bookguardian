import { devices } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';
import { expect, NO_SESSION, signIn, test } from './fixtures';

/**
 * Two people, one instance. A brand-new account lands in its own empty
 * "My Library › Default" and can add a book with a single field; another
 * account never sees that book; and an account can delete itself from
 * Settings after typing its email back.
 *
 * These tests start signed out (`fixtures.ts`) and sign in through the
 * NODE_ENV=test seam with fresh emails, so each one is a new account.
 */
const freshEmail = (tag: string) =>
  `${tag}-${test.info().workerIndex}-${Date.now()}@bookguardian.test`;

test.describe('multi-user', () => {
  test('a new account gets an empty "My Library › Default", adds a book by title, and another account cannot see it', async ({
    page,
    browser,
  }) => {
    const me = freshEmail('new');
    await signIn(page, { email: me, name: 'Newcomer' });

    // The library is there, empty.
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: en.library.title })).toBeVisible();
    const libraries = page.getByTestId('library-list');
    await expect(libraries.getByRole('link', { name: /My Library/ })).toBeVisible();
    await expect(libraries.getByRole('link')).toHaveCount(1);

    await libraries.getByRole('link', { name: /My Library/ }).tap();
    await expect(page.getByRole('heading', { level: 1, name: 'My Library' })).toBeVisible();
    const shelves = page.getByTestId('shelf-list');
    await expect(shelves.getByRole('link', { name: /Default/ })).toBeVisible();
    await expect(shelves.getByRole('link')).toHaveCount(1);
    await shelves.getByRole('link', { name: /Default/ }).tap();
    await expect(page.getByRole('heading', { level: 1, name: 'Default' })).toBeVisible();
    await expect(page.getByText(en.books.empty.title)).toBeVisible();

    // Title only; lands on Default without any picking.
    const title = `Only mine ${test.info().workerIndex}-${Date.now()}`;
    await page.getByTestId('fab').tap();
    const sheet = page.getByRole('dialog', { name: en.books.add });
    await expect(sheet.getByTestId('shelf-label')).toHaveText('My Library › Default');
    await sheet.getByLabel(en.books.field.title).fill(title);
    await sheet.getByRole('button', { name: en.common.save }).tap();
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId('book-card').filter({ hasText: title })).toBeVisible();

    const mine = await page.request.get('/api/books');
    const { items } = (await mine.json()) as { items: { id: string; title: string }[] };
    expect(items.map((b) => b.title)).toEqual([title]);
    const bookId = items[0]!.id;

    // Another account, in a separate browser context (its own cookies).
    const otherContext = await browser.newContext({
      ...devices['iPhone 14'],
      baseURL: test.info().project.use.baseURL,
      storageState: NO_SESSION,
    });
    try {
      const other = await otherContext.newPage();
      await signIn(other, { email: freshEmail('other'), name: 'Someone else' });
      await other.goto('/');
      const theirLibraries = other.getByTestId('library-list');
      await expect(theirLibraries.getByRole('link', { name: /My Library/ })).toBeVisible();

      // Their search finds nothing of mine, their book list is empty, and my book is a 404 to them.
      const theirBooks = await other.request.get('/api/books');
      expect(((await theirBooks.json()) as { items: unknown[] }).items).toEqual([]);
      const search = await other.request.get(`/api/books?q=${encodeURIComponent(title)}`);
      expect(((await search.json()) as { total: number }).total).toBe(0);
      expect((await other.request.get(`/api/books/${bookId}`)).status()).toBe(404);
      expect((await other.request.delete(`/api/books/${bookId}`)).status()).toBe(404);

      await other.goto(`/books/${bookId}`);
      await expect(
        other.getByRole('heading', { level: 1, name: en.errors.notFound }),
      ).toBeVisible();
    } finally {
      await otherContext.close();
    }

    // Still mine, untouched.
    expect((await page.request.get(`/api/books/${bookId}`)).status()).toBe(200);
  });

  test('deleting the account from Settings needs the email typed back, then signs out', async ({
    page,
  }) => {
    const email = freshEmail('leaver');
    await signIn(page, { email, name: 'Leaver' });
    await page.request.post('/api/books', { data: { title: 'Soon gone' } });

    await page.goto('/settings');
    await expect(page.getByTestId('account-email')).toHaveText(email);
    await page.getByTestId('delete-account').tap();

    const warning = page.getByRole('dialog', { name: en.settings.account.deleteTitle });
    await expect(warning).toBeVisible();
    await warning.getByRole('button', { name: en.settings.account.deleteContinue }).tap();

    const confirm = page.getByRole('dialog', { name: en.settings.account.confirmTitle });
    await expect(confirm).toBeVisible();
    const final = confirm.getByRole('button', { name: en.settings.account.deleteFinal });
    await expect(final).toBeDisabled();
    await confirm.getByLabel(en.settings.account.confirmEmailLabel).fill('wrong@bookguardian.test');
    await expect(final).toBeDisabled();
    await expect(confirm.getByRole('alert')).toHaveText(en.settings.account.mismatch);
    await confirm.getByLabel(en.settings.account.confirmEmailLabel).fill(email);
    await expect(final).toBeEnabled();
    await final.tap();

    await expect(page.getByText(en.settings.account.deleted)).toBeVisible();
    // Signed out for good: the login screen, no tab bar.
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login')).toBeVisible();
    await expect(page.getByTestId('tabbar')).toHaveCount(0);

    // The session is gone on the server side too.
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);
    expect((await page.request.get('/api/books')).status()).toBe(401);

    // Signing in again with the same email is a fresh, empty account.
    await signIn(page, { email, name: 'Leaver' });
    const books = await page.request.get('/api/books');
    expect(((await books.json()) as { items: unknown[] }).items).toEqual([]);
  });
});
