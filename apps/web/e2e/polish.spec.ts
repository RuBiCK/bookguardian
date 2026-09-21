import { expect, test, type Page } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';
import { NO_SESSION } from './fixtures';

/**
 * The polish pass, checked on real phone viewports: every control is a
 * thumb-sized target on 390 px and 360 px screens, nothing overflows, sheets
 * and gestures behave, the library opens offline, and motion respects the
 * OS preference.
 */

/** Apple HIG / Material minimum, in CSS px. */
const TAP = 44;
/**
 * Interactive elements that are allowed to be narrower than 44px: the
 * month columns of the read-timeline chart (twelve full-height, 120px-tall
 * targets that share the card width) — and nothing else.
 */
const NARROW_ALLOWED = ['.column'];

async function seed(page: Page) {
  const list = (await (await page.request.get('/api/books?limit=100')).json()) as {
    items: { id: string; title: string; shelfId: string }[];
  };
  const titles = ['Polish One', 'Polish Two', 'Polish Three'];
  for (const title of titles) {
    if (list.items.some((b) => b.title === title)) continue;
    const res = await page.request.post('/api/books', {
      data: { title, authors: ['A. Author'], rating: 4, readStatus: 'read', readAt: '2026-03-01' },
    });
    expect(res.ok(), await res.text()).toBe(true);
  }
  const fresh = (await (await page.request.get('/api/books?limit=100')).json()) as {
    items: { id: string; title: string; shelfId: string }[];
  };
  const one = fresh.items.find((b) => b.title === 'Polish One')!;
  const lendings = (await (await page.request.get('/api/lendings')).json()) as {
    items: { bookId: string }[];
  };
  if (!lendings.items.some((l) => l.bookId === one.id)) {
    await page.request.post('/api/lendings', {
      data: { bookId: one.id, borrowerName: 'Sam', dueAt: '2026-01-01' },
    });
  }
  return { book: one, shelfId: one.shelfId };
}

/** Every visible control on the page with its box, for the tap-target audit. */
async function controls(page: Page) {
  return page.evaluate(
    ({ narrow }) => {
      const out: { label: string; width: number; height: number; narrowOk: boolean }[] = [];
      const nodes = document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea',
      );
      for (const el of nodes) {
        if (el.closest('[aria-hidden="true"]') || el.classList.contains('skip-link')) continue;
        // Layout size, unaffected by the press-state scale transform.
        const rect = { width: el.offsetWidth, height: el.offsetHeight };
        const style = getComputedStyle(el);
        if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden') continue;
        if (el.closest('.visually-hidden')) continue;
        out.push({
          label: `${el.tagName.toLowerCase()}.${el.className.toString().split(' ')[0]} "${(
            el.getAttribute('aria-label') ??
            el.textContent ??
            ''
          )
            .trim()
            .slice(0, 30)}"`,
          width: rect.width,
          height: rect.height,
          narrowOk: narrow.some((sel) => el.matches(sel)),
        });
      }
      return out;
    },
    { narrow: NARROW_ALLOWED },
  );
}

async function auditScreen(page: Page, name: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${name}`).toBe(0);
  const small = (await controls(page)).filter(
    (c) => c.height < TAP - 0.5 || (!c.narrowOk && c.width < TAP - 0.5),
  );
  expect(small, `controls under ${TAP}px on ${name}`).toEqual([]);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  test.describe(`tap targets at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('every control on every screen is at least 44px, nothing overflows', async ({ page }) => {
      test.setTimeout(90_000);
      const { book, shelfId } = await seed(page);

      await page.goto('/');
      await expect(page.getByTestId('library-list')).toBeVisible();
      await auditScreen(page, 'library');

      await page
        .getByTestId('library-list')
        .getByRole('link', { name: /My Library/ })
        .tap();
      await expect(page.getByTestId('shelf-list')).toBeVisible();
      await auditScreen(page, 'library detail');
      await page.getByRole('button', { name: en.common.manage }).tap();
      await expect(page.getByTestId('shelf-row').first()).toBeVisible();
      await auditScreen(page, 'library manage');

      await page.goto(`/shelves/${shelfId}`);
      await expect(page.getByTestId('book-card').first()).toBeVisible();
      await auditScreen(page, 'shelf grid');
      await page.getByRole('button', { name: en.books.view.list }).tap();
      await expect(page.getByTestId('book-row').first()).toBeVisible();
      await auditScreen(page, 'shelf list');
      await page.getByRole('button', { name: en.books.view.grid }).tap();

      await page.goto(`/books/${book.id}`);
      await expect(page.getByRole('heading', { level: 1, name: book.title })).toBeVisible();
      await expect(page.getByTestId('lending-panel')).toContainText('Sam');
      await auditScreen(page, 'book page');

      await page.goto('/lending');
      await expect(page.getByTestId('lending-row').first()).toBeVisible();
      await auditScreen(page, 'lending');

      await page.goto('/stats');
      await expect(page.getByRole('heading', { level: 1, name: en.stats.title })).toBeVisible();
      await expect(page.locator('.stat-tile').first()).toBeVisible();
      await auditScreen(page, 'stats');

      await page.goto('/settings');
      await expect(page.getByTestId('install-row')).toBeVisible();
      await auditScreen(page, 'settings');

      await page.goto('/');
      await page.getByTestId('fab').tap();
      await expect(page.getByRole('dialog', { name: en.books.add })).toBeVisible();
      await auditScreen(page, 'add book sheet');
    });
  });
}

test.describe('login screen', () => {
  test.use({ storageState: NO_SESSION });
  test('is thumb-sized too', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login')).toBeVisible();
    await auditScreen(page, 'login');
  });
});

test.describe('PWA shell', () => {
  test('declares the standalone, notch-aware shell and a translucent status bar', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /viewport-fit=cover/,
    );
    await expect(
      page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
    ).toHaveAttribute('content', 'black-translucent');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // The tab bar and the page reserve the home-indicator inset.
    const uses = await page.evaluate(() => {
      const rules: string[] = [];
      for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) rules.push(rule.cssText);
      }
      const css = rules.join('\n');
      return {
        tabbar: /\.tabbar\s*{[^}]*safe-bottom/.test(css),
        main: /\.app-shell__main\s*{[^}]*safe-top/.test(css),
        sheet: /sheet__footer\s*{[^}]*safe-bottom/.test(css),
      };
    });
    expect(uses).toEqual({ tabbar: true, main: true, sheet: true });
  });

  test('offers the install row in Settings', async ({ page }) => {
    await page.goto('/settings');
    const row = page.getByTestId('install-row');
    await expect(row).toContainText(en.install.label);
    // The iPhone 14 descriptor is Safari on iOS: no install prompt exists there, so
    // the row carries the Share → "Add to Home Screen" instructions instead.
    await expect(row.locator('[data-platform]')).toHaveAttribute('data-platform', 'ios');
    await expect(row).toContainText(en.install.ios);
  });
});

test.describe('gestures', () => {
  test('swipe a row for quick actions: mark read from the tray', async ({ page }) => {
    const { shelfId } = await seed(page);
    const title = `Swipe ${test.info().workerIndex}-${Date.now()}`;
    await page.request.post('/api/books', { data: { title, shelfId } });
    await page.goto(`/shelves/${shelfId}`);
    await page.getByRole('button', { name: en.books.view.list }).tap();
    const row = page.getByTestId('book-row').filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(row).not.toContainText(en.readStatus.read);

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
    await row.getByRole('button', { name: en.quick.markRead }).tap();
    await expect(row).toContainText(en.readStatus.read);
    await expect(row).not.toHaveAttribute('data-open', 'true');
    // Never any sideways overflow while swiping.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('pull down from the top to refresh', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('library-list')).toBeVisible();
    const indicator = page.getByTestId('pull-to-refresh');
    await expect(indicator).toHaveAttribute('data-state', 'idle');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 195, y: 200 }],
    });
    for (let i = 1; i <= 10; i += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 195, y: 200 + i * 25 }],
      });
    }
    await expect(indicator).toHaveAttribute('data-state', 'ready');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(indicator).toHaveAttribute('data-state', 'idle');
    await expect(page.getByTestId('library-list')).toBeVisible();
  });

  test('a sheet springs up, follows a drag on its grip, and slides away', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('fab').tap();
    const dialog = page.getByRole('dialog', { name: en.books.add });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('animation-name', 'sheet-in');
    // Let it land before measuring where the grip is.
    await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

    const grip = dialog.locator('.sheet__header');
    const box = (await grip.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: box.y + 10 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: box.y + 40 }],
    });
    await expect(dialog).toHaveAttribute('data-dragging', 'true');
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: box.y + 200 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByTestId('sheet')).toBeHidden();
  });

  test('tapping a cover morphs it into the book page (view transitions)', async ({ page }) => {
    const { book, shelfId } = await seed(page);
    await page.goto(`/shelves/${shelfId}`);
    expect(await page.evaluate(() => 'startViewTransition' in document)).toBe(true);
    await page.getByTestId('book-card').filter({ hasText: book.title }).first().tap();
    await expect(page.getByRole('heading', { level: 1, name: book.title })).toBeVisible();
    await expect(page.locator('.hero__cover')).toHaveCSS('view-transition-name', 'book-cover');
    await page.getByRole('link', { name: en.common.back }).tap();
    const cover = page
      .getByTestId('book-card')
      .filter({ hasText: book.title })
      .first()
      .locator('.book-card__cover');
    await expect(cover).toHaveCSS('view-transition-name', 'book-cover');
  });
});

test.describe('offline', () => {
  test('the library list opens from the saved copy without a connection, read-only', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await seed(page);
    await page.goto('/');
    await expect(page.getByTestId('library-list')).toContainText('My Library');
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.active !== null;
    });
    // Let the persister flush (it throttles writes to once a second).
    await page.waitForFunction(() =>
      (localStorage.getItem('bookguardian.queryCache') ?? '').includes('My Library'),
    );

    await context.setOffline(true);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.reload();
    await expect(page.getByTestId('offline-banner'), errors.join('\n')).toContainText(
      en.offline.title,
    );
    await expect(page.getByTestId('library-list')).toContainText('My Library');

    // Writes fail fast with the offline explanation and roll back.
    await page.getByTestId('fab').tap();
    const sheet = page.getByRole('dialog', { name: en.books.add });
    await sheet.getByLabel(en.books.field.title).fill('Offline ghost');
    await sheet.getByRole('button', { name: en.common.save }).tap();
    await expect(page.getByText(en.errors.offline)).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByTestId('offline-banner')).toBeHidden();
    const books = (await (await page.request.get('/api/books?q=Offline%20ghost')).json()) as {
      total: number;
    };
    expect(books.total).toBe(0);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('turns animations off', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('fab').tap();
    const dialog = page.getByRole('dialog', { name: en.books.add });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('animation-name', 'none');
    const durations = await page.evaluate(() => {
      const card = document.querySelector('.cards > li');
      return card ? getComputedStyle(card).animationDuration : null;
    });
    expect(durations).toBe('1e-05s'); // 0.01ms, as Chromium reports it
  });
});
