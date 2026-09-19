import { expect, test } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';

/**
 * The core promise of the app on a 390px phone: a fresh install already has
 * "My Library › Default", and adding a book never needs more than the title.
 */
test.describe('inventory', () => {
  test('fresh install → add a book with only a title → it sits on the Default shelf', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: en.library.title })).toBeVisible();

    // The seeded library is already there.
    const libraries = page.getByTestId('library-list');
    await expect(libraries.getByRole('link', { name: /My Library/ })).toBeVisible();

    // Tap 1: the FAB. Tap 2: Save. Nothing else touched.
    const title = `Dune ${test.info().workerIndex}-${Date.now()}`;
    await page.getByTestId('fab').tap();
    const sheet = page.getByRole('dialog', { name: en.books.add });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('shelf-label')).toHaveText('My Library › Default');
    await sheet.getByLabel(en.books.field.title).fill(title);
    await sheet.getByRole('button', { name: en.common.save }).tap();

    await expect(sheet).toBeHidden();
    await expect(page.getByText(`Added to My Library › Default`)).toBeVisible();

    // Library → Default shelf → the book is in the grid.
    await libraries.getByRole('link', { name: /My Library/ }).tap();
    await expect(page.getByRole('heading', { level: 1, name: 'My Library' })).toBeVisible();
    await page
      .getByTestId('shelf-list')
      .getByRole('link', { name: /Default/ })
      .tap();
    await expect(page.getByRole('heading', { level: 1, name: 'Default' })).toBeVisible();
    const card = page.getByTestId('book-card').filter({ hasText: title });
    await expect(card).toBeVisible();

    // Detail page reflects the shelf and offers the actions.
    await card.tap();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByTestId('book-shelf')).toHaveText('My Library › Default');
    await expect(page.getByRole('button', { name: en.common.move })).toBeVisible();

    // No horizontal overflow anywhere along the way.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('the API reports the seeded defaults and the created book', async ({ request }) => {
    const defaults = await request.get('/api/defaults');
    expect(defaults.ok()).toBe(true);
    const { libraryId, shelfId } = (await defaults.json()) as {
      libraryId: string;
      shelfId: string;
    };

    const created = await request.post('/api/books', { data: { title: 'API only' } });
    expect(created.status()).toBe(201);
    expect(await created.json()).toMatchObject({ shelfId });

    const shelves = await request.get(`/api/shelves?libraryId=${libraryId}`);
    const { items } = (await shelves.json()) as { items: { id: string; name: string }[] };
    expect(items.map((s) => s.name)).toContain('Default');
  });
});
