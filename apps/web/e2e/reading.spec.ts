import { expect, test } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface ApiBook {
  id: string;
  shelfId: string;
  rating: number | null;
  readStatus: string;
  startedAt: string | null;
  readAt: string | null;
}

/**
 * Reading life on a 390px phone: mark a book read from its page, the finished
 * date is stamped with today, and the book shows up under the "Read" filter.
 */
test.describe('reading life', () => {
  test('mark read → read_at populated → listed under the "Read" filter, rated by tap', async ({
    page,
    request,
  }) => {
    const title = `Emma ${test.info().workerIndex}-${Date.now()}`;
    const created = await request.post('/api/books', {
      data: { title, authors: ['Jane Austen'] },
    });
    expect(created.status()).toBe(201);
    const book = (await created.json()) as ApiBook;

    await page.goto(`/books/${book.id}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    const reading = page.getByRole('region', { name: en.reading.title });
    await expect(reading.getByLabel(en.reading.readAt)).toHaveCount(0);

    // One tap: "Read". The finished date appears, pre-filled with today.
    await reading.getByRole('button', { name: en.readStatus.read, exact: true }).tap();
    await expect(
      reading.getByRole('button', { name: en.readStatus.read, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(reading.getByLabel(en.reading.readAt)).toHaveValue(today());
    await expect
      .poll(async () => (await (await request.get(`/api/books/${book.id}`)).json()) as ApiBook)
      .toMatchObject({ readStatus: 'read', readAt: today() });

    // One tap: four stars.
    await reading.getByRole('button', { name: '4 stars' }).tap();
    await expect(reading.getByRole('group', { name: en.reading.rating })).toContainText('4 stars');
    await expect
      .poll(
        async () => ((await (await request.get(`/api/books/${book.id}`)).json()) as ApiBook).rating,
      )
      .toBe(4);

    // Back on the shelf, the "Read" filter lists it and "To read" does not.
    await page.getByRole('link', { name: en.common.back }).tap();
    await expect(page.getByRole('heading', { level: 1, name: 'Default' })).toBeVisible();
    const card = page.getByTestId('book-card').filter({ hasText: title });
    await page.getByRole('button', { name: en.readStatus.read, exact: true }).tap();
    await expect(card).toBeVisible();
    await expect(card).toContainText(en.readStatus.read);
    await page.getByRole('button', { name: en.readStatus.to_read }).tap();
    await expect(card).toBeHidden();
    await page.getByRole('button', { name: en.readStatus.all }).tap();
    await page.getByRole('button', { name: '4+ ★' }).tap();
    await expect(card).toBeVisible();

    // Long-press the cover: quick actions open without leaving the shelf.
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 20);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    const sheet = page.getByRole('dialog', { name: title });
    await expect(sheet).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Default' })).toBeVisible();
    await sheet.getByRole('button', { name: en.readStatus.reading }).tap();
    await expect(sheet.getByLabel(en.reading.startedAt)).toHaveValue(today());
    await expect
      .poll(async () => (await (await request.get(`/api/books/${book.id}`)).json()) as ApiBook)
      .toMatchObject({ readStatus: 'reading', startedAt: today(), readAt: null });

    // No horizontal overflow with the sheet open.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('the API enforces the rating range and the date rules', async ({ request }) => {
    const created = await request.post('/api/books', { data: { title: 'Rules', rating: 0 } });
    const book = (await created.json()) as ApiBook;
    expect(book.rating).toBeNull();

    const tooHigh = await request.patch(`/api/books/${book.id}`, { data: { rating: 6 } });
    expect(tooHigh.status()).toBe(422);

    const early = await request.patch(`/api/books/${book.id}`, {
      data: { readStatus: 'read', startedAt: '2024-02-01', readAt: '2024-01-01' },
    });
    expect(early.status()).toBe(422);
    expect(((await early.json()) as { error: { code: string } }).error.code).toBe(
      'invalid_reading_dates',
    );

    const read = await request.patch(`/api/books/${book.id}`, { data: { readStatus: 'read' } });
    expect(((await read.json()) as ApiBook).readAt).toBe(today());
  });
});
