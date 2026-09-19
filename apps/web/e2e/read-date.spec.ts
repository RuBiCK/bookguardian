import { expect, test } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';
import { localDate } from '@bookguardian/shared';

/**
 * Marking a book as read stamps today and lets the reader correct the day in
 * the same row — one thumb, 390px wide.
 */
test.describe('read date', () => {
  test('tap Read → today, pick an earlier day → it sticks; un-read clears it', async ({
    page,
    request,
  }) => {
    const title = `Read date ${test.info().workerIndex}-${Date.now()}`;
    const created = await request.post('/api/books', { data: { title } });
    expect(created.ok()).toBe(true);
    const { id } = (await created.json()) as { id: string };

    await page.goto(`/books/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByLabel(en.books.field.readAt)).toHaveCount(0);

    // Tap 1: "Read". The date row appears already filled with today.
    await page.getByRole('button', { name: en.readStatus.read, exact: true }).tap();
    const readAt = page.getByLabel(en.books.field.readAt);
    await expect(readAt).toBeVisible();
    await expect(readAt).toHaveValue(localDate());
    await expect(readAt).toHaveAttribute('max', localDate());

    // Tap 2: the date box → pick an earlier day. Saved without any further tap.
    await readAt.fill('2024-03-10');
    await expect(readAt).toHaveValue('2024-03-10');
    await expect
      .poll(
        async () =>
          ((await (await request.get(`/api/books/${id}`)).json()) as { readAt: string }).readAt,
      )
      .toBe('2024-03-10');

    await test.info().attach('read-date-390px', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // The corrected day survives a reload.
    await page.reload();
    await expect(page.getByLabel(en.books.field.readAt)).toHaveValue('2024-03-10');

    // A future day is refused client-side and never stored.
    await page.getByLabel(en.books.field.readAt).fill('2999-01-01');
    await expect(page.getByRole('alert')).toHaveText(en.books.readAtFuture);
    const stored = (await (await request.get(`/api/books/${id}`)).json()) as { readAt: string };
    expect(stored.readAt).toBe('2024-03-10');

    // Back to "Reading": the date goes away.
    await page.getByRole('button', { name: en.readStatus.reading, exact: true }).tap();
    await expect(page.getByLabel(en.books.field.readAt)).toHaveCount(0);
    await expect
      .poll(
        async () =>
          ((await (await request.get(`/api/books/${id}`)).json()) as { readAt: string | null })
            .readAt,
      )
      .toBeNull();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('the API refuses a future read date and stamps today when none is given', async ({
    request,
  }) => {
    const created = await request.post('/api/books', { data: { title: 'API read date' } });
    const { id } = (await created.json()) as { id: string };

    const stamped = await request.patch(`/api/books/${id}`, { data: { readStatus: 'read' } });
    expect(stamped.ok()).toBe(true);
    expect(((await stamped.json()) as { readAt: string }).readAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const future = await request.patch(`/api/books/${id}`, { data: { readAt: '2999-01-01' } });
    expect(future.status()).toBe(422);
  });
});
