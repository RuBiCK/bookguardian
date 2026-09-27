import { devices } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';
import { expect, NO_SESSION, signIn, test } from './fixtures';

/**
 * The first-session tour on a 390 px phone (BOOK-35).
 *
 * These specs sign brand-new accounts in with the tour still pending
 * (`completeOnboarding: false`), which every other spec turns off — the tour is
 * a modal sheet and would otherwise cover the screens they assert on.
 */
const freshEmail = (tag: string) =>
  `tour-${tag}-${test.info().workerIndex}-${Date.now()}@bookguardian.test`;

const STEPS = [
  en.onboarding.steps.welcome,
  en.onboarding.steps.adding,
  en.onboarding.steps.lending,
  en.onboarding.steps.done,
];

test.describe('first-session tour', () => {
  test('a new account is walked through the four steps, finishes into the add form, and never sees it again', async ({
    page,
  }) => {
    await signIn(
      page,
      { email: freshEmail('finish'), name: 'Tour Finisher' },
      {
        completeOnboarding: false,
      },
    );
    await page.goto('/');

    const tour = page.getByTestId('tour');
    await expect(tour).toBeVisible();
    // Thumb reach: every control in the sheet is a 44px target.
    for (const id of ['tour-next', 'tour-skip']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box!.height, id).toBeGreaterThanOrEqual(44);
    }

    for (const [index, step] of STEPS.entries()) {
      await expect(page.getByRole('dialog', { name: step.title })).toBeVisible();
      await expect(tour).toContainText(step.body);
      for (const line of Object.values(step.items)) await expect(tour).toContainText(line);
      await expect(page.getByTestId('tour-progress')).toContainText(
        `Step ${index + 1} of ${STEPS.length}`,
      );
      // Nothing overflows the 390px viewport at any step.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, step.title).toBe(0);
      if (index < STEPS.length - 1) await page.getByTestId('tour-next').tap();
    }

    await expect(page.getByRole('link', { name: en.onboarding.guide })).toHaveAttribute(
      'href',
      /docs\/user-guide\.md$/,
    );

    // The closing CTA lands on the Library tab with the add sheet open.
    await page.getByTestId('tour-cta').tap();
    await expect(page.getByRole('dialog', { name: en.books.add })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: en.library.title })).toBeVisible();

    // Remembered on the account: a reload does not bring it back.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: en.library.title })).toBeVisible();
    await expect(page.getByTestId('tour')).toHaveCount(0);
  });

  test('skipping from the first step counts the same, and Settings can replay it', async ({
    page,
  }) => {
    await signIn(
      page,
      { email: freshEmail('skip'), name: 'Tour Skipper' },
      {
        completeOnboarding: false,
      },
    );
    await page.goto('/');

    await expect(page.getByTestId('tour')).toBeVisible();
    await page.getByTestId('tour-skip').tap();
    await expect(page.getByTestId('tour')).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: en.library.title })).toBeVisible();
    await expect(page.getByTestId('tour')).toHaveCount(0);

    // Replaying it from Settings shows the tour again and leaves the state alone.
    await page.getByTestId('tabbar').getByRole('link', { name: en.nav.settings }).tap();
    await page.getByTestId('replay-tour').tap();
    await expect(page.getByRole('dialog', { name: STEPS[0]!.title })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('tour')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('tour')).toHaveCount(0);
  });

  test('the tour in light and dark, 390px wide', async ({ browser }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        ...devices['iPhone 14'],
        baseURL: test.info().project.use.baseURL,
        storageState: NO_SESSION,
        colorScheme,
      });
      const page = await context.newPage();
      await signIn(
        page,
        { email: freshEmail(colorScheme), name: 'Tour Looker' },
        {
          completeOnboarding: false,
        },
      );
      await page.goto('/');
      await expect(page.getByTestId('tour')).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`tour-welcome-${colorScheme}.png`) });

      await page.getByTestId('tour-next').tap();
      await expect(page.getByRole('dialog', { name: STEPS[1]!.title })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`tour-adding-${colorScheme}.png`) });
      await context.close();
    }
  });
});
