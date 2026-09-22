import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';

/**
 * Regenerates the landing page's static images into `apps/web/public/`:
 *
 * - `landing/app-light.png` / `landing/app-dark.png` — a shelf of the really
 *   running app, cropped to 390×560 at 2× and shown in the hero.
 * - `og.png` — the 1200×630 Open Graph / Twitter card.
 *
 * Opt-in, like the screenshot tour: the regular suite skips it so CI never
 * rewrites a committed asset. To refresh them after a visual change:
 *
 *     E2E_LANDING_ASSETS=1 pnpm --filter @bookguardian/web exec \
 *       playwright test landing-assets
 *
 * then review the diff and commit the PNGs.
 */
const enabled = process.env.E2E_LANDING_ASSETS === '1';
/** Playwright runs from `apps/web`, so `public/` is where the assets live. */
const publicDir = 'public';

/** The card says what the landing page says, in the source locale. */
const COPY = {
  name: en.app.name,
  title: en.landing.hero.title,
  body: en.landing.meta.description,
};

/** The light-theme tokens, inlined: the card is rendered outside the app. */
const CARD = {
  bg: '#f7f4ee',
  surface: '#fffdf8',
  border: '#dcd5c7',
  fg: '#1d1a15',
  muted: '#625c51',
  accent: '#b5542d',
  contrast: '#fff8f2',
};

/**
 * Real books with no ISBN, so every cover is the app's own title/author
 * placeholder: the picture stays the same whatever the metadata providers
 * happen to return.
 */
const BOOKS = [
  {
    title: 'The Left Hand of Darkness',
    authors: ['Ursula K. Le Guin'],
    rating: 5,
    readStatus: 'read',
    readAt: '2026-08-02',
    pages: 304,
    language: 'en',
  },
  {
    title: 'Piranesi',
    authors: ['Susanna Clarke'],
    rating: 4,
    readStatus: 'read',
    readAt: '2026-06-14',
    pages: 272,
    language: 'en',
  },
  {
    title: 'Cien años de soledad',
    authors: ['Gabriel García Márquez'],
    readStatus: 'reading',
    pages: 471,
    language: 'es',
  },
  {
    title: 'The Design of Everyday Things',
    authors: ['Don Norman'],
    rating: 4,
    readStatus: 'read',
    readAt: '2026-03-20',
    pages: 368,
    language: 'en',
  },
  {
    title: 'Braiding Sweetgrass',
    authors: ['Robin Wall Kimmerer'],
    readStatus: 'to_read',
    pages: 391,
    language: 'en',
  },
  {
    title: 'Klara and the Sun',
    authors: ['Kazuo Ishiguro'],
    rating: 3,
    readStatus: 'read',
    readAt: '2026-01-09',
    pages: 320,
    language: 'en',
  },
];

test.describe('landing assets', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!enabled, 'set E2E_LANDING_ASSETS=1 to regenerate');

  test('captures the app in both themes and builds the sharing card', async ({
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    mkdirSync(join(publicDir, 'landing'), { recursive: true });
    const shelfId = await seed(request);

    for (const scheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        ...test.info().project.use,
        storageState: process.env.E2E_STORAGE_STATE,
        colorScheme: scheme,
        // The crop the hero shows: a shelf's cover grid. 1.5× of a 390px
        // phone is 585px wide, exactly 2× the 292px slot it is shown in.
        viewport: { width: 390, height: 620 },
        deviceScaleFactor: 1.5,
      });
      const page = await context.newPage();
      await page.goto(`/shelves/${shelfId}`);
      await expect(page.getByTestId('book-card').first()).toBeVisible();
      // Past the search box and the filter chips: the books are the picture.
      await page.evaluate(() => window.scrollTo(0, 250));
      // Let the arrival animations settle before the shutter.
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(publicDir, 'landing', `app-${scheme}.png`) });
      await context.close();
    }

    const shot = readFileSync(join(publicDir, 'landing', 'app-light.png')).toString('base64');
    const context = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
    });
    const page = await context.newPage();
    await page.setContent(card(shot));
    await page.screenshot({ path: join(publicDir, 'og.png') });
    await context.close();
  });
});

/** A shelf worth photographing; returns the shelf the books landed on. */
async function seed(request: APIRequestContext): Promise<string> {
  for (const book of BOOKS) {
    const existing = (await (
      await request.get(`/api/books?q=${encodeURIComponent(book.title)}`)
    ).json()) as { items: { title: string }[] };
    if (existing.items.some((b) => b.title === book.title)) continue;
    const res = await request.post('/api/books', { data: book });
    expect(res.ok(), await res.text()).toBe(true);
  }
  const books = (await (await request.get('/api/books?limit=1')).json()) as {
    items: { shelfId: string }[];
  };
  return books.items[0]!.shelfId;
}

/** The sharing card: the app mark, the promise, and the real app beside it. */
function card(screenshotBase64: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    display: flex; align-items: center; gap: 56px;
    width: 1200px; height: 630px; padding: 64px 72px;
    background: ${CARD.bg}; color: ${CARD.fg};
    font-family: ui-rounded, 'SF Pro Rounded', -apple-system, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
  }
  .copy { flex: 1; display: flex; flex-direction: column; gap: 24px; }
  .brand { display: flex; align-items: center; gap: 14px;
    font-size: 22px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    color: ${CARD.muted}; }
  .mark { width: 44px; height: 44px; border-radius: 24%; }
  h1 { font-size: 58px; line-height: 1.1; letter-spacing: -0.02em; max-width: 14ch; }
  p { font-size: 26px; line-height: 1.35; color: ${CARD.muted}; max-width: 30ch; }
  .shot { width: 300px; flex: none; border: 1px solid ${CARD.border};
    border-radius: 26px; background: ${CARD.surface};
    box-shadow: 0 18px 48px rgb(29 26 21 / 18%); overflow: hidden; }
  .shot img { display: block; width: 100%; }
</style></head>
<body>
  <div class="copy">
    <div class="brand">
      <svg class="mark" viewBox="0 0 512 512">
        <rect width="512" height="512" rx="112" fill="${CARD.accent}" />
        <g fill="${CARD.contrast}">
          <rect x="112" y="128" width="72" height="256" rx="10" />
          <rect x="208" y="128" width="72" height="256" rx="10" />
          <rect x="292" y="140" width="72" height="256" rx="10" transform="rotate(-14 328 268)" />
        </g>
      </svg>
      ${COPY.name}
    </div>
    <h1>${COPY.title}</h1>
    <p>${COPY.body}</p>
  </div>
  <div class="shot"><img alt="" src="data:image/png;base64,${screenshotBase64}" /></div>
</body></html>`;
}
