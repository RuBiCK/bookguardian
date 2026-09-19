import { expect, test } from '@playwright/test';
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

  test('navigates between tabs', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tabbar').getByRole('link', { name: en.nav.settings }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { level: 1, name: en.settings.title })).toBeVisible();
  });

  test('serves a web app manifest', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const manifest = (await res.json()) as { name: string; display: string };
    expect(manifest.name).toBe('Bookguardian');
    expect(manifest.display).toBe('standalone');
  });
});
