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

export interface SignInUser {
  email: string;
  name?: string;
}

export interface SignInOptions {
  /**
   * Whether to mark the first-session tour as seen right after signing in
   * (default `true`). A brand-new account has it pending, and the tour is a
   * modal sheet over whatever screen the spec meant to exercise — only
   * `onboarding.spec.ts` wants it, and it passes `false`.
   */
  completeOnboarding?: boolean;
}

/** Sign this page's context in as `user` through the test seam (no Google). */
export async function signIn(
  page: Page,
  user: SignInUser = E2E_USER,
  { completeOnboarding = true }: SignInOptions = {},
) {
  const res = await page.request.post('/api/auth/test-login', { data: user });
  if (!res.ok()) throw new Error(`test-login failed: ${res.status()} ${await res.text()}`);
  if (!completeOnboarding) return;
  const seen = await page.request.patch('/api/auth/me', { data: { onboardingCompleted: true } });
  if (!seen.ok()) throw new Error(`onboarding patch failed: ${seen.status()}`);
}

export const test = base.extend<{
  signIn: (user?: SignInUser, options?: SignInOptions) => Promise<void>;
}>({
  // A fresh, signed-out context; call `signIn()` to get a session of its own.
  storageState: NO_SESSION,
  signIn: async ({ page }, use) => {
    await use((user, options) => signIn(page, user, options));
  },
});

export { expect } from '@playwright/test';
