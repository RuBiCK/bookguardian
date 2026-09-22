import { en } from '@bookguardian/shared/i18n';
import { E2E_USER, expect, test } from './fixtures';

/**
 * Sign-in screen and session lifecycle on a 390px phone. These tests start
 * signed out (see `fixtures.ts`) and sign in through `POST /api/auth/test-login`,
 * which the API registers under NODE_ENV=test; the Google flow itself is
 * covered by the API's integration tests against a fake Google.
 */
test.describe('sign-in', () => {
  test('/login is one tap and nothing else, with no tab bar', async ({ page }) => {
    // `/` is the public landing page (see landing.spec.ts); `/login` is the
    // screen it — and every guarded route — hands over to.
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: en.app.name })).toBeVisible();
    await expect(page.getByTestId('tabbar')).toHaveCount(0);

    const button = page.getByRole('link', { name: en.auth.google });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('href', '/api/auth/google');
    // One thumb: the button spans the width and is at least 44px tall.
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThan(300);
    // Nothing else to tap.
    expect(await page.getByRole('link').count()).toBe(1);
    expect(await page.getByRole('button').count()).toBe(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('a deep link is remembered and honoured after signing in', async ({ page, signIn }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fsettings$/);
    await expect(page.getByRole('link', { name: en.auth.google })).toHaveAttribute(
      'href',
      '/api/auth/google?return_to=%2Fsettings',
    );

    // The API sets the cookie (as the Google callback would); the login route
    // sees the session and continues to where the person was going.
    await signIn();
    await page.reload();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { level: 1, name: en.settings.title })).toBeVisible();
    await expect(page.getByTestId('tabbar')).toBeVisible();

    // Home shows the library; /login now bounces straight back home.
    await page.goto('/login');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: en.library.title })).toBeVisible();
    await expect(
      page.getByTestId('library-list').getByRole('link', { name: /My Library/ }),
    ).toBeVisible();
  });

  test('the Google button explains when sign-in is not configured, with a retry', async ({
    page,
  }) => {
    await page.goto('/login?redirect=%2Flending');
    // The e2e API runs without Google credentials: the navigation comes back
    // to /login carrying the error code and the original destination.
    await page.getByRole('link', { name: en.auth.google }).tap();
    await expect(page).toHaveURL(/\/login\?error=auth_not_configured&redirect=%2Flending$/);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(en.auth.error.title);
    await expect(alert).toContainText(en.auth.error.auth_not_configured);
    await expect(page.getByRole('link', { name: en.auth.google })).toHaveAttribute(
      'href',
      '/api/auth/google?return_to=%2Flending',
    );
  });

  test('a session that disappears server-side sends the app back to /login', async ({
    page,
    signIn,
  }) => {
    await signIn();
    await page.goto('/lending');
    await expect(page.getByRole('heading', { level: 1, name: en.lending.title })).toBeVisible();

    // Revoke it behind the app's back, then make it talk to the API again.
    await page.request.post('/api/auth/logout');
    await page.getByTestId('tabbar').getByRole('link', { name: en.nav.settings }).tap();
    await expect(page).toHaveURL(/\/login\?redirect=%2Fsettings$/);
    await expect(page.getByTestId('login')).toBeVisible();
  });

  test('the service worker never caches /api (the session is always checked live)', async ({
    page,
    signIn,
  }) => {
    await signIn();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: en.library.title })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.goto('/settings');
    await expect(page.getByTestId('account')).toBeVisible();

    const cachedApiUrls = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        for (const req of await (await caches.open(name)).keys()) urls.push(req.url);
      }
      return urls.filter((u) => new URL(u).pathname.startsWith('/api/'));
    });
    expect(cachedApiUrls).toEqual([]);
  });
});

test.describe('account', () => {
  test('settings shows who is signed in; sign out lands on /login and the API says 401', async ({
    page,
    signIn,
  }) => {
    await signIn();
    await page.goto('/settings');
    const account = page.getByTestId('account');
    await expect(account).toBeVisible();
    await expect(account).toContainText(E2E_USER.name);
    await expect(page.getByTestId('account-email')).toHaveText(E2E_USER.email);
    await expect(page.getByTestId('avatar-initial')).toHaveText('E');
    expect((await page.request.get('/api/auth/me')).status()).toBe(200);
    await page.screenshot({ path: test.info().outputPath('settings-account.png') });

    await page.getByTestId('sign-out').tap();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login')).toBeVisible();
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);
    expect((await page.request.get('/api/libraries')).status()).toBe(401);

    // And the app agrees: a protected route goes back to /login.
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fsettings$/);
  });

  test('the login screen in light and dark, 390px wide', async ({ browser }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        ...test.info().project.use,
        storageState: { cookies: [], origins: [] },
        colorScheme,
      });
      const page = await context.newPage();
      await page.goto('/login');
      await expect(page.getByRole('link', { name: en.auth.google })).toBeVisible();
      const button = page.getByTestId('google-sign-in');
      // Google's branding colours: white in light, #131314 in dark.
      const bg = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toBe(colorScheme === 'dark' ? 'rgb(19, 19, 20)' : 'rgb(255, 255, 255)');
      await page.screenshot({ path: test.info().outputPath(`login-${colorScheme}.png`) });
      await context.close();
    }
  });
});
