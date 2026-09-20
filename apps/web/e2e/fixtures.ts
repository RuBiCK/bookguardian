/**
 * Session fixtures for the e2e suite.
 *
 * Every spec runs signed in already: `global-setup.ts` signs in once through
 * `POST /api/auth/test-login` and the resulting cookie is the storage state
 * each browser context starts from (see `playwright.config.ts`). Import
 * `test` from here instead of `@playwright/test` when a test needs to
 * *manage* the session itself — start signed out, sign in as someone else,
 * sign out — without touching the shared one: a sign-out would revoke it for
 * every other worker.
 */
import { test as base, type Page } from '@playwright/test';
import { E2E_USER } from './global-setup';

export { E2E_USER };
export const NO_SESSION = { cookies: [], origins: [] };

/** Sign this page's context in as `user` through the test seam (no Google). */
export async function signIn(page: Page, user: { email: string; name?: string } = E2E_USER) {
  const res = await page.request.post('/api/auth/test-login', { data: user });
  if (!res.ok()) throw new Error(`test-login failed: ${res.status()} ${await res.text()}`);
}

export const test = base.extend<{
  signIn: (user?: { email: string; name?: string }) => Promise<void>;
}>({
  // A fresh, signed-out context; call `signIn()` to get a session of its own.
  storageState: NO_SESSION,
  signIn: async ({ page }, use) => {
    await use((user) => signIn(page, user));
  },
});

export { expect } from '@playwright/test';
