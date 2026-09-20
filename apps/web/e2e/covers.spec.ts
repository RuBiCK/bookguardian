import { expect, test, type Page } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';

/**
 * Covers on a 390px phone: a book with an ISBN gets a real cover from the
 * (stubbed) provider through the API's cascade, books without one show the
 * title/author placeholder, and Settings can backfill what is missing. The
 * API stores WebP files and serves them itself; the provider stub only
 * hands out the original PNGs.
 */
const STUB = 'http://localhost:3101';
// The stub knows this one from the start (scan.spec.ts owns Dune's ISBN; do not reuse it).
const KNOWN_ISBN = '9780141439587';
const UNKNOWN_ISBN = '9780306406157'; // nobody has a cover… until the test says so

async function addBook(page: Page, body: Record<string, unknown>) {
  const res = await page.request.post('/api/books', { data: body });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { id: string; coverPending: boolean; coverUrl: string | null };
}

test.describe('covers', () => {
  test('grid mixes real covers with placeholders, and the cover page swaps in when it lands', async ({
    page,
  }) => {
    const run = `${test.info().workerIndex}-${Date.now()}`;
    const dune = await addBook(page, {
      title: `Emma ${run}`,
      authors: ['Jane Austen'],
      isbn13: KNOWN_ISBN,
    });
    const notes = await addBook(page, { title: `Notebook ${run}`, authors: ['Me'] });
    const ghost = await addBook(page, {
      title: `Ghost ${run}`,
      authors: ['Nobody'],
      isbn13: UNKNOWN_ISBN,
    });
    expect(dune.coverPending).toBe(true);
    expect(notes.coverPending).toBe(false);

    await page.goto('/');
    await page
      .getByTestId('library-list')
      .getByRole('link', { name: /My Library/ })
      .tap();
    await page
      .getByTestId('shelf-list')
      .getByRole('link', { name: /Default/ })
      .tap();
    await expect(page.getByRole('heading', { level: 1, name: 'Default' })).toBeVisible();

    // The placeholder is a coloured card carrying title and author.
    const notesCard = page.getByTestId('book-card').filter({ hasText: `Notebook ${run}` });
    const notesCover = notesCard.getByTestId('book-cover');
    await expect(notesCover).toHaveAttribute('data-state', 'placeholder');
    await expect(notesCover).toContainText('Me');
    const background = await notesCover
      .locator('.cover__placeholder')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).not.toBe('rgba(0, 0, 0, 0)');

    // The cascade lands without a reload: the grid polls while a cover is pending.
    const duneCover = page
      .getByTestId('book-card')
      .filter({ hasText: `Emma ${run}` })
      .getByTestId('book-cover');
    await expect(duneCover).toHaveAttribute('data-state', 'loaded', { timeout: 15_000 });
    const img = duneCover.locator('img');
    await expect(img).toHaveAttribute('src', /\/api\/covers\/[a-f0-9]{64}-thumb\.webp$/);
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    // A stored cover is served by the API as immutable WebP.
    const src = await img.getAttribute('src');
    const file = await page.request.get(src!);
    expect(file.headers()['content-type']).toBe('image/webp');
    expect(file.headers()['cache-control']).toBe('public, max-age=31536000, immutable');

    // No provider had the third one: it settles on the placeholder.
    const ghostCover = page
      .getByTestId('book-card')
      .filter({ hasText: `Ghost ${run}` })
      .getByTestId('book-cover');
    await expect(ghostCover).toHaveAttribute('data-state', 'placeholder', { timeout: 15_000 });
    await test.info().attach('grid-covers-and-placeholders-390px', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    // Dark mode: the placeholder carries its own colours, so it stays legible.
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
    });
    await expect(notesCover).toContainText(`Notebook ${run}`);
    await test.info().attach('grid-covers-and-placeholders-dark-390px', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
    });

    // The book page uses the same cover and offers to change it.
    await page
      .getByTestId('book-card')
      .filter({ hasText: `Emma ${run}` })
      .tap();
    await expect(page.getByRole('heading', { level: 1, name: `Emma ${run}` })).toBeVisible();
    await page.getByRole('button', { name: en.books.cover.change }).tap();
    const sheet = page.getByRole('dialog', { name: en.books.cover.title });
    await expect(sheet.getByRole('button', { name: en.books.cover.choosePhoto })).toBeVisible();
    await expect(sheet.getByRole('button', { name: en.books.cover.useCatalogue })).toBeHidden();
    await sheet.getByRole('button', { name: en.common.close }).tap();
    void ghost;
  });

  test('settings backfill finds covers that were missing and shows progress', async ({ page }) => {
    const run = `${test.info().workerIndex}-${Date.now()}`;
    // Use an ISBN of our own so parallel workers do not race on the same cache row.
    const isbn = `97815${String(Date.now()).slice(-7)}`.padEnd(12, '0');
    const isbn13 = withCheckDigit(isbn);
    const late = await addBook(page, { title: `Late ${run}`, authors: ['Ana'], isbn13 });
    // Let the first cascade miss, then teach the stub about the ISBN.
    await expect
      .poll(
        async () =>
          (
            (await (await page.request.get(`/api/books/${late.id}`)).json()) as {
              coverPending: boolean;
            }
          ).coverPending,
        {
          timeout: 15_000,
        },
      )
      .toBe(false);
    expect((await page.request.post(`${STUB}/__stub/enable/${isbn13}/3`)).ok()).toBeTruthy();

    await page.goto('/settings');
    await page.getByRole('button', { name: en.settings.covers.find }).tap();
    const progress = page.getByTestId('covers-progress');
    await expect(progress).toBeVisible();
    await expect(progress).toContainText(/covers? found/, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: en.settings.covers.find })).toBeEnabled();

    const after = (await (await page.request.get(`/api/books/${late.id}`)).json()) as {
      coverUrl: string | null;
    };
    expect(after.coverUrl).toMatch(/^\/api\/covers\/[a-f0-9]{64}\.webp$/);
  });
});

/** Append the EAN-13 check digit to 12 digits. */
function withCheckDigit(twelve: string): string {
  const sum = [...twelve].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return `${twelve}${(10 - (sum % 10)) % 10}`;
}
