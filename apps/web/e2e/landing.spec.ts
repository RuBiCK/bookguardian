import { en, es } from '@bookguardian/shared/i18n';
import { expect, test } from './fixtures';

/**
 * The public landing page at `/` on a 390px phone. These tests start signed
 * out (see `fixtures.ts`); the signed-in half signs in through the API's test
 * seam and checks that `/` is the library, not the landing.
 */
const FEATURE_COUNT = Object.keys(en.landing.features).length - 1; // minus `title`

test.describe('landing page', () => {
  test('a logged-out visitor lands on it, reads what the app does, and taps in', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('landing')).toBeVisible();

    // One h1, the promise, and no app chrome.
    const headings = page.getByRole('heading', { level: 1 });
    await expect(headings).toHaveCount(1);
    await expect(headings).toHaveText(en.landing.hero.title);
    await expect(page.getByTestId('tabbar')).toHaveCount(0);

    // Every shipped feature is on the page.
    const cards = page.getByTestId('landing-features').getByRole('listitem');
    await expect(cards).toHaveCount(FEATURE_COUNT);
    await expect(cards.first()).toContainText(en.landing.features.shelves.title);
    await expect(cards.last()).toContainText(en.landing.features.selfhost.body);

    // Nothing spills sideways on a 390px screen.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    // One thumb-sized way in, which hands over to /login and its Google button.
    const cta = page.getByTestId('landing-login');
    const box = (await cta.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    await cta.tap();
    await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
    await expect(page.getByRole('link', { name: en.auth.google })).toHaveAttribute(
      'href',
      '/api/auth/google',
    );
  });

  test('the login button is reachable and operable from the keyboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing')).toBeVisible();

    const cta = page.getByTestId('landing-login');
    for (
      let i = 0;
      i < 10 && !(await cta.evaluate((el) => el === document.activeElement));
      i += 1
    ) {
      await page.keyboard.press('Tab');
    }
    await expect(cta).toBeFocused();
    // A visible ring, not just focus.
    const outline = await cta.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
  });

  test('switches between English and Spanish and remembers the choice', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.landing.hero.title);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByRole('button', { name: es.landing.footer.languages.es, exact: true }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(es.landing.hero.title);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(es.landing.hero.title);
  });

  test('shows the app in the theme the visitor is in, light and dark', async ({ browser }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        ...test.info().project.use,
        storageState: { cookies: [], origins: [] },
        colorScheme,
      });
      const page = await context.newPage();
      await page.goto('/');
      await expect(page.getByTestId('landing')).toBeVisible();

      const shown = await page
        .locator('.landing__shot img')
        .evaluateAll((images) =>
          images
            .filter((img) => getComputedStyle(img).display !== 'none')
            .map((img) => img.getAttribute('data-scheme')),
        );
      expect(shown).toEqual([colorScheme]);
      await page.screenshot({
        path: test.info().outputPath(`landing-${colorScheme}.png`),
        fullPage: true,
      });
      await context.close();
    }
  });

  test('is the only route crawlers are invited into', async ({ page }) => {
    const robots = await page.request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    const body = await robots.text();
    expect(body).toContain('User-agent: *');
    for (const path of ['/login', '/books', '/settings', '/stats', '/api/']) {
      expect(body).toContain(`Disallow: ${path}`);
    }
    expect(body).not.toMatch(/^Disallow: \/$/m);

    // And the shell carries the tags a crawler or a chat unfurl reads.
    await page.goto('/');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      en.landing.meta.description,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /^https?:\/\/.+\/og\.png$/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
  });
});

test.describe('landing page, signed in', () => {
  test('never appears: / goes straight to the library', async ({ page, signIn }) => {
    await signIn();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: en.library.title })).toBeVisible();
    await expect(page.getByTestId('landing')).toHaveCount(0);
    await expect(page.getByTestId('tabbar')).toBeVisible();

    // And the Library tab keeps going home without ever showing it.
    await page.getByTestId('tabbar').getByRole('link', { name: en.nav.stats }).tap();
    await expect(page.getByRole('heading', { level: 1, name: en.stats.title })).toBeVisible();
    await page.getByTestId('tabbar').getByRole('link', { name: en.nav.library }).tap();
    await expect(page.getByRole('heading', { level: 1, name: en.library.title })).toBeVisible();
    await expect(page.getByTestId('landing')).toHaveCount(0);
  });
});
