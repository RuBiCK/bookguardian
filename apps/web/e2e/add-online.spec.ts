import { expect, test } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';

/**
 * Adding a book by hand on a 390px phone, with the catalogues doing the
 * typing: a title and an author, "Search online", pick the second match,
 * Save — and the book sits on the Default shelf with the online cover. The
 * API talks to the provider stub (`providers-stub.mjs`), which answers the
 * search and serves the cover images, so the whole path runs for real.
 */
test.describe('add book → search online', () => {
  test('type title + author, search, pick the second result, save, find it with its cover', async ({
    page,
  }) => {
    const run = `${test.info().workerIndex}-${Date.now()}`;
    await page.goto('/');
    await page.getByTestId('fab').tap();
    const sheet = page.getByRole('dialog', { name: en.books.add });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('shelf-label')).toHaveText('My Library › Default');

    // Nothing typed yet: nothing to search for.
    const search = sheet.getByTestId('search-online');
    await expect(search).toBeDisabled();
    await sheet
      .getByRole('textbox', { name: en.books.field.title, exact: true })
      .fill('Foundation');
    await sheet.getByRole('textbox', { name: en.books.field.authors, exact: true }).fill('Asimov');
    await expect(search).toBeEnabled();
    // The button is within one-thumb reach on the 390×844 viewport.
    const box = (await search.boundingBox())!;
    expect(box.y + box.height).toBeLessThan(844);
    await search.tap();

    const results = page.getByRole('dialog', { name: en.books.search.title });
    await expect(results).toBeVisible();
    const rows = results.getByTestId('result');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Foundation');
    await expect(rows.nth(1)).toContainText('Foundation and Empire');
    await expect(rows.nth(1)).toContainText('Isaac Asimov');
    await expect(rows.nth(1)).toContainText('Bantam Spectra · 1991');
    await expect(rows.nth(1)).toContainText('ISBN 9780553293371');
    await expect(rows.nth(1)).toContainText('Open Library');
    await test.info().attach('search-results-390px', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await rows.nth(1).tap();
    await expect(results).toBeHidden();

    // Typed fields kept (with a chip for the title the catalogue spells differently), the rest filled.
    await expect(
      sheet.getByRole('textbox', { name: en.books.field.title, exact: true }),
    ).toHaveValue('Foundation');
    await expect(sheet.getByTestId('suggestion-title')).toContainText(
      'Use online value: Foundation and Empire',
    );
    await expect(
      sheet.getByRole('textbox', { name: en.books.field.authors, exact: true }),
    ).toHaveValue('Asimov');
    await expect(sheet.getByTestId('suggestion-authors')).toContainText('Isaac Asimov');
    await expect(
      sheet.getByRole('textbox', { name: en.books.field.isbn, exact: true }),
    ).toHaveValue('9780553293371');
    await expect(
      sheet.getByRole('textbox', { name: en.books.field.publisher, exact: true }),
    ).toHaveValue('Bantam Spectra');
    await expect(
      sheet.getByRole('textbox', { name: en.books.field.year, exact: true }),
    ).toHaveValue('1991');
    await expect(
      sheet.getByRole('textbox', { name: en.books.field.pages, exact: true }),
    ).toHaveValue('320');
    await expect(sheet.getByTestId('filled-from')).toHaveText('Filled from Open Library');
    await sheet.getByTestId('suggestion-title').tap();
    await expect(
      sheet.getByRole('textbox', { name: en.books.field.title, exact: true }),
    ).toHaveValue('Foundation and Empire');
    await sheet.getByTestId('suggestion-authors').tap();
    await expect(
      sheet.getByRole('textbox', { name: en.books.field.authors, exact: true }),
    ).toHaveValue('Isaac Asimov');
    await expect(sheet.getByTestId('suggestion-authors')).toBeHidden();
    await test.info().attach('form-filled-390px', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    // Make the title unique per run so parallel workers never collide in the grid.
    const title = `Foundation and Empire ${run}`;
    await sheet.getByRole('textbox', { name: en.books.field.title, exact: true }).fill(title);
    await sheet.getByRole('button', { name: en.common.save }).tap();
    await expect(sheet).toBeHidden();
    await expect(page.getByText('Added to My Library › Default')).toBeVisible();

    // Library → Default shelf → the book, with the cover the cascade fetched by ISBN.
    await page
      .getByTestId('library-list')
      .getByRole('link', { name: /My Library/ })
      .tap();
    await page
      .getByTestId('shelf-list')
      .getByRole('link', { name: /Default/ })
      .tap();
    await expect(page.getByRole('heading', { level: 1, name: 'Default' })).toBeVisible();
    const card = page.getByTestId('book-card').filter({ hasText: title });
    await expect(card).toBeVisible();
    const cover = card.getByTestId('book-cover');
    await expect(cover).toHaveAttribute('data-state', 'loaded', { timeout: 15_000 });
    await expect(cover.locator('img')).toHaveAttribute(
      'src',
      /\/api\/covers\/[a-f0-9]{64}-thumb\.webp$/,
    );
    await test.info().attach('shelf-with-online-cover-390px', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    // The detail page carries the merged metadata.
    await card.tap();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('.hero__authors')).toHaveText('Isaac Asimov');
    await expect(page.getByText('9780553293371')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('empty and error states keep the typed data', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('fab').tap();
    const sheet = page.getByRole('dialog', { name: en.books.add });
    await sheet
      .getByRole('textbox', { name: en.books.field.title, exact: true })
      .fill('Nothing anyone wrote');
    await sheet.getByRole('textbox', { name: en.books.field.title, exact: true }).press('Enter'); // Enter searches, never saves
    const results = page.getByRole('dialog', { name: en.books.search.title });
    await expect(results.getByText(en.books.search.empty.title)).toBeVisible();
    await results.getByTestId('keep-typed').tap();
    await expect(results).toBeHidden();
    await expect(
      sheet.getByRole('textbox', { name: en.books.field.title, exact: true }),
    ).toHaveValue('Nothing anyone wrote');

    // Providers down: the sheet says so and offers a retry.
    await page.route('**/api/lookup/search**', (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: 'lookup_unavailable', message: 'down' } },
      }),
    );
    await sheet.getByTestId('search-online').tap();
    await expect(results.getByText(en.books.search.error.title)).toBeVisible();
    await page.unroute('**/api/lookup/search**');
    await results.getByRole('button', { name: en.common.retry }).tap();
    await expect(results.getByText(en.books.search.empty.title)).toBeVisible();
    await test.info().attach('empty-state-390px', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await results.getByTestId('keep-typed').tap();
    await expect(sheet).toBeVisible();
  });
});
