import { en } from '@bookguardian/shared/i18n';
import { expect, signIn, test } from './fixtures';

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const thisMonth = () => localDate(new Date()).slice(0, 7);
const lastMonth = () => {
  const d = new Date();
  return localDate(new Date(d.getFullYear(), d.getMonth() - 1, 10));
};

/**
 * Stats on a 390px phone, for a fresh account so every number is known:
 * the empty state first, then the hero row, the donut and the breakdowns,
 * and a tap on a category segment opens that filtered list.
 */
test.describe('stats', () => {
  test('empty state → hero numbers and breakdowns → tap a segment to see those books', async ({
    page,
  }) => {
    const suffix = `${test.info().workerIndex}-${Date.now()}`;
    await signIn(page, { email: `stats-${suffix}@bookguardian.test`, name: 'Stats Tester' });

    await page.goto('/stats');
    await expect(page.getByRole('heading', { level: 1, name: en.stats.title })).toBeVisible();
    await expect(page.getByText(en.stats.empty.title)).toBeVisible();

    // Four books with known facets; one read this month, one last month, one lent.
    const books = [
      {
        title: `Dune ${suffix}`,
        authors: ['Frank Herbert'],
        categories: ['Science fiction'],
        language: 'en',
        pages: 412,
        rating: 5,
        readStatus: 'read',
        readAt: localDate(new Date()),
      },
      {
        title: `Dune Messiah ${suffix}`,
        authors: ['Frank Herbert'],
        categories: ['Science fiction'],
        language: 'en',
        rating: 4,
        readStatus: 'read',
        readAt: lastMonth(),
      },
      {
        title: `Cien años ${suffix}`,
        authors: ['Gabriel García Márquez'],
        categories: ['Fiction'],
        language: 'es',
        readStatus: 'reading',
      },
      {
        title: `Good Omens ${suffix}`,
        authors: ['Terry Pratchett', 'Neil Gaiman'],
        categories: ['Fantasy', 'Fiction'],
        language: 'en',
      },
    ];
    const ids: string[] = [];
    for (const data of books) {
      const res = await page.request.post('/api/books', { data });
      expect(res.status()).toBe(201);
      ids.push(((await res.json()) as { id: string }).id);
    }
    const lent = await page.request.post('/api/lendings', {
      data: { bookId: ids[0], borrowerName: 'Ana' },
    });
    expect(lent.status()).toBe(201);

    await page.reload();
    const tiles = page.getByTestId('stat-tiles');
    await expect(tiles.getByTestId('stat-tile-books')).toHaveText(`4${en.stats.hero.books}`);
    await expect(tiles.getByTestId('stat-tile-read')).toHaveText(`2${en.stats.hero.read}`);
    await expect(tiles.getByTestId('stat-tile-toRead')).toHaveText(`1${en.stats.hero.toRead}`);
    await expect(tiles.getByTestId('stat-tile-lent')).toHaveText(`1${en.stats.hero.lent}`);

    const status = page.getByTestId('stats-status');
    await expect(status.getByTestId('legend-read')).toHaveText('Read2');
    await expect(status.getByTestId('legend-reading')).toHaveText('Reading1');
    await expect(status.getByTestId('legend-to_read')).toHaveText('To read1');

    const timeline = page.getByTestId('stats-timeline');
    await expect(timeline.getByTestId('column')).toHaveCount(24);
    await expect(timeline.getByTestId('column').last()).toHaveAttribute(
      'href',
      new RegExp(`readFrom=${thisMonth()}-01`),
    );
    const categories = page.getByTestId('stats-categories');
    await expect(categories.getByTestId('bar-row')).toHaveText([
      /Fiction2/,
      /Science fiction2/,
      /Fantasy1/,
    ]);
    await expect(page.getByTestId('stats-languages').getByTestId('bar-row')).toHaveText([
      /English3/,
      /Spanish1/,
    ]);

    // Nothing wider than the phone.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Tap "Fantasy": the filtered list, with the one book and a way back.
    await categories.getByRole('link', { name: 'Fantasy: 1 books' }).tap();
    await expect(page.getByRole('heading', { level: 1, name: en.books.all })).toBeVisible();
    await expect(page.getByText('Category · Fantasy')).toBeVisible();
    await expect(page.getByTestId('book-card')).toHaveCount(1);
    await expect(page.getByTestId('book-card')).toContainText(`Good Omens ${suffix}`);
    await page.getByRole('link', { name: en.common.back }).tap();
    await expect(page.getByRole('heading', { level: 1, name: en.stats.title })).toBeVisible();

    // The "Read" tile opens the list with the status chip already pressed.
    await tiles.getByTestId('stat-tile-read').tap();
    await expect(page.getByRole('button', { name: en.readStatus.read, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('book-card')).toHaveCount(2);
  });
});
