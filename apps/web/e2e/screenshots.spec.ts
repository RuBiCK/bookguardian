import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';

/**
 * Screenshot tour of the main screens in both themes, for design reviews and
 * before/after comparisons on an issue. Opt-in: `E2E_SCREENSHOTS=1` (with an
 * optional `E2E_SCREENSHOT_DIR`, default `playwright-screenshots/`); the
 * regular suite skips it so CI time is not spent on pictures.
 */
const enabled = process.env.E2E_SCREENSHOTS === '1';
const outDir = process.env.E2E_SCREENSHOT_DIR ?? 'playwright-screenshots';

const BOOKS = [
  {
    title: 'The Left Hand of Darkness',
    authors: ['Ursula K. Le Guin'],
    rating: 5,
    readStatus: 'read',
    readAt: '2026-08-02',
    pages: 304,
    language: 'en',
    categories: ['Science fiction'],
  },
  {
    title: 'Piranesi',
    authors: ['Susanna Clarke'],
    rating: 4,
    readStatus: 'read',
    readAt: '2026-06-14',
    pages: 272,
    language: 'en',
    categories: ['Fantasy'],
  },
  {
    title: 'Cien años de soledad',
    authors: ['Gabriel García Márquez'],
    readStatus: 'reading',
    pages: 471,
    language: 'es',
    categories: ['Fiction'],
  },
  {
    title: 'The Design of Everyday Things',
    authors: ['Don Norman'],
    rating: 4,
    readStatus: 'read',
    readAt: '2026-03-20',
    pages: 368,
    language: 'en',
    categories: ['Design'],
  },
  {
    title: 'Braiding Sweetgrass',
    authors: ['Robin Wall Kimmerer'],
    readStatus: 'to_read',
    pages: 391,
    language: 'en',
    categories: ['Nature'],
  },
  {
    title: 'Klara and the Sun',
    authors: ['Kazuo Ishiguro'],
    rating: 3,
    readStatus: 'read',
    readAt: '2026-01-09',
    pages: 320,
    language: 'en',
    categories: ['Fiction'],
  },
] as const;

test.describe('screenshots', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!enabled, 'set E2E_SCREENSHOTS=1 to capture');

  for (const scheme of ['light', 'dark'] as const) {
    test(`tour (${scheme})`, async ({ browser, request }) => {
      test.setTimeout(120_000);
      mkdirSync(join(outDir, scheme), { recursive: true });
      const shot = async (page: Page, name: string) => {
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(outDir, scheme, `${name}.png`), fullPage: false });
      };

      // Seed a small library through the API (idempotent enough: titles are looked up first).
      const existing = (await (await request.get('/api/books?limit=100')).json()) as {
        items: { id: string; title: string }[];
      };
      const ids = new Map(existing.items.map((b) => [b.title, b.id]));
      for (const book of BOOKS) {
        if (ids.has(book.title)) continue;
        const res = await request.post('/api/books', { data: book });
        expect(res.ok(), await res.text()).toBe(true);
        const created = (await res.json()) as { id: string };
        ids.set(book.title, created.id);
      }
      const lent = (await (await request.get('/api/lendings')).json()) as {
        items: { bookId: string }[];
      };
      if (lent.items.length === 0) {
        const res = await request.post('/api/lendings', {
          data: { bookId: ids.get('Piranesi'), borrowerName: 'Marta', dueAt: '2026-09-01' },
        });
        expect(res.ok(), await res.text()).toBe(true);
      }

      const context = await browser.newContext({
        ...test.info().project.use,
        colorScheme: scheme,
        storageState: process.env.E2E_STORAGE_STATE,
      });
      const page = await context.newPage();

      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1, name: en.library.title })).toBeVisible();
      await shot(page, '01-library');

      await page
        .getByTestId('library-list')
        .getByRole('link', { name: /My Library/ })
        .tap();
      await expect(page.getByRole('heading', { level: 1, name: 'My Library' })).toBeVisible();
      await shot(page, '02-library-detail');

      await page
        .getByTestId('shelf-list')
        .getByRole('link', { name: /Default/ })
        .tap();
      await expect(page.getByRole('heading', { level: 1, name: 'Default' })).toBeVisible();
      await expect(page.getByTestId('book-card').first()).toBeVisible();
      await shot(page, '03-shelf-grid');

      // List view with a row's swipe actions revealed (only in builds that have it).
      const listToggle = page.getByRole('button', { name: en.books.view?.list ?? '__none__' });
      if (await listToggle.count()) {
        await listToggle.tap();
        const row = page.getByTestId('book-row').first();
        await expect(row).toBeVisible();
        const box = (await row.boundingBox())!;
        const cdp = await page.context().newCDPSession(page);
        const y = box.y + box.height / 2;
        const startX = box.x + box.width - 20;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: startX, y }],
        });
        for (let i = 1; i <= 8; i += 1) {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: startX - i * 30, y }],
          });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect(row).toHaveAttribute('data-open', 'true');
        await shot(page, '03b-shelf-list-swipe');
        await page.getByRole('button', { name: en.books.view.grid }).tap();
        await expect(page.getByTestId('book-card').first()).toBeVisible();
      }

      await page.getByTestId('book-card').filter({ hasText: 'Left Hand' }).first().tap();
      await expect(page.getByRole('heading', { level: 1, name: /Left Hand/ })).toBeVisible();
      await shot(page, '04-book-page');

      await page.goto('/lending');
      await expect(page.getByRole('heading', { level: 1, name: en.lending.title })).toBeVisible();
      await shot(page, '05-lending');

      await page.goto('/stats');
      await expect(page.getByRole('heading', { level: 1, name: en.stats.title })).toBeVisible();
      await shot(page, '06-stats');

      await page.goto('/settings');
      await expect(page.getByRole('heading', { level: 1, name: en.settings.title })).toBeVisible();
      await shot(page, '07-settings');

      await page.goto('/');
      await page.getByTestId('fab').tap();
      await expect(page.getByRole('dialog', { name: en.books.add })).toBeVisible();
      await shot(page, '08-add-sheet');

      await context.close();
    });
  }
});
