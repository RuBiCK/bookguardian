import { expect, test, type Page } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';

test.describe('app shell', () => {
  test('loads on a phone viewport with the five tabs', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: en.library.title })).toBeVisible();

    const tabbar = page.getByTestId('tabbar');
    await expect(tabbar).toBeVisible();
    for (const label of Object.values(en.nav)) {
      await expect(tabbar.getByRole('link', { name: label })).toBeVisible();
    }

    // The tab bar must span the 390px-wide viewport and sit at the bottom edge (thumb reach).
    const viewport = page.viewportSize();
    const box = await tabbar.boundingBox();
    expect(viewport?.width).toBe(390);
    expect(box).not.toBeNull();
    expect(box!.width).toBe(390);
    expect(box!.y + box!.height).toBeCloseTo(viewport!.height, 0);
  });

  test('every tab is tappable and marks itself active', async ({ page }) => {
    await page.goto('/');
    const tabbar = page.getByTestId('tabbar');
    const screens: [string, string, RegExp][] = [
      [en.nav.scan, en.scan.title, /\/scan$/],
      [en.nav.lending, en.lending.title, /\/lending$/],
      [en.nav.stats, en.stats.title, /\/stats$/],
      [en.nav.settings, en.settings.title, /\/settings$/],
      [en.nav.library, en.library.title, /\/$/],
    ];
    for (const [label, title, url] of screens) {
      await tabbar.getByRole('link', { name: label }).tap();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(tabbar.getByRole('link', { name: label })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(tabbar.locator('[aria-current="page"]')).toHaveCount(1);
    }
  });

  test('deep links and unknown paths render inside the shell', async ({ page }) => {
    await page.goto('/stats');
    await expect(page.getByRole('heading', { level: 1, name: en.stats.title })).toBeVisible();

    await page.goto('/nope/nothing');
    await expect(page.getByRole('heading', { level: 1, name: en.errors.notFound })).toBeVisible();
    await expect(page.getByTestId('tabbar')).toBeVisible();
  });

  test('has no horizontal overflow on a 390px screen', async ({ page }) => {
    for (const path of ['/', '/settings']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflow on ${path}`).toBe(0);
    }
  });
});

test.describe('theme', () => {
  test('follows the OS dark preference by default', async ({ browser }) => {
    const context = await browser.newContext({
      ...test.info().project.use,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('/');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(21, 19, 15)'); // --bg in dark tokens
    await context.close();
  });

  test('a manual choice persists across reloads', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: en.settings.theme.dark }).tap();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: en.settings.theme.dark })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(21, 19, 15)');
  });
});

test.describe('API integration', () => {
  test('settings shows the live API status through the /api proxy', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByTestId('api-status')).toHaveText(/Online \(sqlite\)/);
  });

  test('the proxied health endpoint returns the shared envelope', async ({ request }) => {
    const ok = await request.get('/api/health');
    expect(ok.ok()).toBe(true);
    expect(await ok.json()).toMatchObject({ status: 'ok', database: { driver: 'sqlite' } });

    const bad = await request.get('/api/health?shallow=nope');
    expect(bad.status()).toBe(422);
    expect(await bad.json()).toMatchObject({ error: { code: 'validation_error' } });
  });
});

test.describe('PWA', () => {
  test('serves a web app manifest with icons', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const manifest = (await res.json()) as {
      name: string;
      display: string;
      icons: { src: string; sizes: string; purpose?: string }[];
    };
    expect(manifest.name).toBe('Bookguardian');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(
      true,
    );
    for (const icon of manifest.icons) {
      const img = await request.get(`/${icon.src}`);
      expect(img.ok(), icon.src).toBe(true);
    }
  });

  test('registers a service worker', async ({ page }) => {
    await page.goto('/');
    const sw = await serviceWorkerActive(page);
    expect(sw).toBe(true);
  });
});

async function serviceWorkerActive(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    return registration.active !== null;
  });
}
