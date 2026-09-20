import { expect, test, type Page } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';

/**
 * Scan tab on a 390px phone. Chromium gets a fake camera so the live scanner
 * starts (the fake feed shows a test pattern, not a barcode); real decoding is
 * exercised through the "choose a photo" path with a barcode rendered in the
 * page. Catalogue lookups are stubbed at the network edge so the suite never
 * depends on Open Library / Google being reachable.
 */
test.use({
  permissions: ['camera'],
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
});

const DUNE_ISBN = '9780441013593';
const DRAFT = {
  isbn10: '0441013597',
  isbn13: DUNE_ISBN,
  title: 'Dune',
  subtitle: null,
  authors: ['Frank Herbert'],
  publisher: 'Ace',
  publishedDate: '1965',
  pages: 412,
  language: 'en',
  coverUrl: null,
  categories: ['Science fiction'],
  description: 'Desert planet.',
  source: 'open_library',
  sourceId: '/books/OL1M',
};

/** Render `isbn13` as an EAN-13 barcode PNG using the page's canvas. */
async function barcodePng(page: Page, isbn13: string): Promise<Buffer> {
  const dataUrl = await page.evaluate((digits) => {
    const L = [
      '0001101',
      '0011001',
      '0010011',
      '0111101',
      '0100011',
      '0110001',
      '0101111',
      '0111011',
      '0110111',
      '0001011',
    ];
    const G = [
      '0100111',
      '0110011',
      '0011011',
      '0100001',
      '0011101',
      '0111001',
      '0000101',
      '0010001',
      '0001001',
      '0010111',
    ];
    const R = L.map((p) => [...p].map((b) => (b === '0' ? '1' : '0')).join(''));
    const PARITY = [
      'LLLLLL',
      'LLGLGG',
      'LLGGLG',
      'LLGGGL',
      'LGLLGG',
      'LGGLLG',
      'LGGGLL',
      'LGLGLG',
      'LGLGGL',
      'LGGLGL',
    ];
    const d = [...digits].map(Number);
    const parity = PARITY[d[0]!]!;
    let bits = '101';
    for (let i = 1; i <= 6; i += 1) bits += (parity[i - 1] === 'L' ? L : G)[d[i]!];
    bits += '01010';
    for (let i = 7; i <= 12; i += 1) bits += R[d[i]!];
    bits += '101';

    const module = 4;
    const quiet = 12;
    const height = 140;
    const canvas = document.createElement('canvas');
    canvas.width = (bits.length + quiet * 2) * module;
    canvas.height = height + 40;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    [...bits].forEach((bit, i) => {
      if (bit === '1') ctx.fillRect((quiet + i) * module, 20, module, height);
    });
    return canvas.toDataURL('image/png');
  }, isbn13);
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

test.describe('scan', () => {
  test('a barcode photo → catalogue result → one tap adds the book to the Default shelf', async ({
    page,
    request,
  }) => {
    let lookups = 0;
    await page.route(`**/api/lookup/isbn/${DUNE_ISBN}`, async (route) => {
      lookups += 1;
      await route.fulfill({ json: DRAFT });
    });

    await page.goto('/scan');
    await expect(page.getByRole('heading', { level: 1, name: en.scan.title })).toBeVisible();
    // The fake camera streams, so the live scanner reaches its ready state.
    await expect(page.getByTestId('scanner')).toHaveAttribute('data-state', 'live', {
      timeout: 15_000,
    });
    await expect(page.getByTestId('scanner-status')).toHaveText(en.scan.camera.ready);

    const png = await barcodePng(page, DUNE_ISBN);
    await page
      .getByTestId('isbn-photo')
      .setInputFiles({ name: 'barcode.png', mimeType: 'image/png', buffer: png });

    const sheet = page.getByRole('dialog', { name: en.scan.result.title });
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    expect(lookups).toBe(1);
    // The draft card and its placeholder cover both carry the title/author.
    await expect(sheet.locator('.draft__title', { hasText: 'Dune' })).toBeVisible();
    await expect(sheet.locator('.draft__authors', { hasText: 'Frank Herbert' })).toBeVisible();

    const add = sheet.getByRole('button', { name: 'Add to My Library › Default' });
    await expect(add).toBeEnabled();
    // The whole sheet, including the primary action, sits in thumb reach.
    const box = await add.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await add.tap();

    await expect(sheet).toBeHidden();
    await expect(page.getByText('Added to My Library › Default')).toBeVisible();
    // The scanner is back for the next book.
    await expect(page.getByTestId('scanner')).toHaveAttribute('data-state', 'live', {
      timeout: 15_000,
    });

    const books = await request.get(`/api/books?q=${DUNE_ISBN}`);
    const { items } = (await books.json()) as { items: { title: string; isbn13: string }[] };
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: 'Dune', isbn13: DUNE_ISBN });
  });

  test('a typed ISBN that no catalogue knows falls through to the manual form', async ({
    page,
  }) => {
    const isbn = '9780141439587';
    await page.route(`**/api/lookup/isbn/${isbn}`, (route) =>
      route.fulfill({
        status: 404,
        json: { error: { code: 'isbn_not_found', message: 'nope', details: { isbn } } },
      }),
    );
    await page.goto('/scan');

    const input = page.getByLabel(en.scan.manual.label);
    await input.fill('978-0-14-143958-7');
    await page.getByRole('button', { name: en.scan.manual.submit }).tap();

    const notFound = page.getByRole('dialog', { name: en.scan.result.notFoundTitle });
    await expect(notFound).toContainText(`No book found for ISBN ${isbn}.`);
    await notFound.getByRole('button', { name: en.scan.result.addManually }).tap();

    const form = page.getByRole('dialog', { name: en.books.add });
    await expect(form.getByLabel(en.books.field.isbn)).toHaveValue(isbn);
    const title = `Emma ${test.info().workerIndex}-${Date.now()}`;
    await form.getByLabel(en.books.field.title, { exact: true }).fill(title);
    await form.getByRole('button', { name: en.common.save }).tap();
    await expect(form).toBeHidden();
    await expect(page.getByText('Added to My Library › Default')).toBeVisible();
  });

  test('a photo without a barcode and an unreachable catalogue both explain themselves', async ({
    page,
  }) => {
    await page.goto('/scan');
    const blank = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 200;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ddd';
      ctx.fillRect(0, 0, 300, 200);
      return canvas.toDataURL('image/png');
    });
    await page.getByTestId('isbn-photo').setInputFiles({
      name: 'blank.png',
      mimeType: 'image/png',
      buffer: Buffer.from(blank.split(',')[1]!, 'base64'),
    });
    const notice = page.getByTestId('scan-notice');
    await expect(notice).toContainText(en.scan.noBarcode, { timeout: 15_000 });
    await notice.getByRole('button', { name: en.scan.cover.tryAgain }).tap();
    await expect(notice).toBeHidden();

    await page.route('**/api/lookup/**', (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: 'lookup_unavailable', message: 'down' } },
      }),
    );
    await page.getByLabel(en.scan.manual.label).fill(DUNE_ISBN);
    await page.getByRole('button', { name: en.scan.manual.submit }).tap();
    await expect(page.getByTestId('scan-notice')).toContainText(en.scan.result.lookupFailed);
  });

  test('cover mode offers camera + gallery capture and keeps the layout within 390px', async ({
    page,
  }) => {
    await page.goto('/scan');
    await page.getByRole('button', { name: en.scan.mode.cover }).tap();
    await expect(page.getByText(en.scan.cover.hint)).toBeVisible();
    await expect(page.getByTestId('cover-camera')).toHaveAttribute('capture', 'environment');
    await expect(page.getByTestId('cover-photo')).toHaveAttribute('accept', 'image/*');
    await expect(page.getByRole('button', { name: en.scan.takePhoto })).toBeVisible();
    await expect(page.getByRole('button', { name: en.scan.pickPhoto })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  /**
   * Real on-device OCR: tesseract.js downloads its worker, WASM core and the
   * English model from CDNs on first use, so this only runs when the suite is
   * explicitly allowed to use the network (E2E_NETWORK=1).
   */
  test('cover photo → on-device OCR → candidate list (network)', async ({ page }) => {
    test.skip(!process.env.E2E_NETWORK, 'needs network access for tesseract.js assets');
    test.setTimeout(180_000);
    await page.route('**/api/lookup/search**', (route) =>
      route.fulfill({ json: { items: [DRAFT] } }),
    );
    await page.goto('/scan');
    await page.getByRole('button', { name: en.scan.mode.cover }).tap();

    const cover = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 800, 1200);
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.font = 'bold 140px sans-serif';
      ctx.fillText('DUNE', 400, 420);
      ctx.font = 'bold 70px sans-serif';
      ctx.fillText('FRANK HERBERT', 400, 640);
      return canvas.toDataURL('image/png');
    });
    await page.getByTestId('cover-photo').setInputFiles({
      name: 'cover.png',
      mimeType: 'image/png',
      buffer: Buffer.from(cover.split(',')[1]!, 'base64'),
    });
    await expect(page.getByTestId('cover-progress')).toBeVisible();
    const candidates = page.getByTestId('candidates');
    await expect(candidates).toBeVisible({ timeout: 150_000 });
    await expect(candidates.getByRole('button').first()).toHaveAccessibleName(
      'Dune — Frank Herbert',
    );
  });
});
