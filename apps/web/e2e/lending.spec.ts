import { expect, test } from '@playwright/test';
import { en } from '@bookguardian/shared/i18n';

interface ApiBook {
  id: string;
  shelfId: string;
}

interface ApiLending {
  id: string;
  bookId: string;
  borrowerName: string;
  borrowerContact: string | null;
  dueAt: string | null;
  returnedAt: string | null;
  overdue: boolean;
}

const dayFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Lending on a 390px phone: lend from the book page (two taps + a name),
 * find it in the Lending tab under the borrower, tap "Returned" once.
 */
test.describe('lending', () => {
  test('lend from the book page → listed in the Lending tab → returned with one tap', async ({
    page,
    request,
  }) => {
    const title = `Neuromancer ${test.info().workerIndex}-${Date.now()}`;
    const borrower = `Ana ${test.info().workerIndex}-${Date.now()}`;
    const created = await request.post('/api/books', {
      data: { title, authors: ['William Gibson'] },
    });
    expect(created.status()).toBe(201);
    const book = (await created.json()) as ApiBook;

    await page.goto(`/books/${book.id}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    const panel = page.getByTestId('lending-panel');
    await panel.getByRole('button', { name: en.lending.lend }).tap();

    const sheet = page.getByRole('dialog', { name: `Lend “${title}”` });
    await expect(sheet).toBeVisible();
    await sheet.getByLabel(en.lending.field.borrower).fill(borrower);
    await sheet.getByLabel(/Due back/).fill(dayFromToday(7));
    await sheet.getByRole('button', { name: en.lending.lend }).tap();
    await expect(sheet).toBeHidden();

    // The page says who has it, right away.
    await expect(panel.getByText(`Lent to ${borrower}`)).toBeVisible();
    await expect(panel.getByText(en.lending.outToday)).toBeVisible();
    await expect(panel.getByText(/^Due /)).toBeVisible();
    await expect
      .poll(async () => {
        const res = await request.get(`/api/books/${book.id}/lendings`);
        return ((await res.json()) as { items: ApiLending[] }).items;
      })
      .toMatchObject([{ borrowerName: borrower, dueAt: dayFromToday(7), returnedAt: null }]);

    // The cover carries a "Lent" badge on the shelf.
    await page.getByRole('link', { name: en.common.back }).tap();
    await expect(page.getByRole('heading', { level: 1, name: 'Default' })).toBeVisible();
    const card = page.getByTestId('book-card').filter({ hasText: title });
    await expect(card.getByText(en.lending.lent)).toBeVisible();

    // Lending tab: grouped under the borrower, with a one-tap "Returned".
    await page.getByTestId('tabbar').getByRole('link', { name: en.nav.lending }).tap();
    await expect(page.getByRole('heading', { level: 1, name: en.lending.title })).toBeVisible();
    const group = page.getByTestId('borrower-group').filter({ hasText: borrower });
    await expect(group.getByRole('heading', { level: 2 })).toHaveText(borrower);
    const row = group.getByTestId('lending-row').filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(row.getByText(en.lending.outToday)).toBeVisible();

    // No horizontal overflow with a long title and the button on one row.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    await row.getByRole('button', { name: en.lending.markReturned }).tap();
    await expect(row).toBeHidden();
    await expect(page.getByText(`“${title}” is back`)).toBeVisible();
    await expect
      .poll(async () => {
        const res = await request.get(`/api/books/${book.id}/lendings`);
        const { items } = (await res.json()) as { items: ApiLending[] };
        return items[0]?.returnedAt;
      })
      .not.toBeNull();

    // Back on the book page the loan is history and the book can go out again.
    await page.goto(`/books/${book.id}`);
    await expect(panel.getByRole('button', { name: en.lending.lend })).toBeVisible();
    await expect(panel.getByTestId('lending-history')).toContainText(borrower);
  });

  test('the API keeps one active lending per book and flags overdue ones', async ({ request }) => {
    const created = await request.post('/api/books', { data: { title: 'Rules' } });
    const book = (await created.json()) as ApiBook;

    const first = await request.post('/api/lendings', {
      data: { bookId: book.id, borrowerName: 'Ana', dueAt: dayFromToday(-1) },
    });
    expect(first.status()).toBe(201);
    const lending = (await first.json()) as ApiLending;
    expect(lending.overdue).toBe(true);

    const again = await request.post('/api/lendings', {
      data: { bookId: book.id, borrowerName: 'Bo' },
    });
    expect(again.status()).toBe(409);
    expect(((await again.json()) as { error: { code: string } }).error.code).toBe('already_lent');

    const overdue = await request.get('/api/lendings?overdue=true');
    expect(((await overdue.json()) as { items: ApiLending[] }).items.map((l) => l.id)).toContain(
      lending.id,
    );

    const returned = await request.post(`/api/lendings/${lending.id}/return`, { data: {} });
    expect(returned.status()).toBe(200);
    expect(((await returned.json()) as ApiLending).overdue).toBe(false);
    const twice = await request.post(`/api/lendings/${lending.id}/return`, { data: {} });
    expect(twice.status()).toBe(409);

    const second = await request.post('/api/lendings', {
      data: { bookId: book.id, borrowerName: 'Bo' },
    });
    expect(second.status()).toBe(201);
  });
});
