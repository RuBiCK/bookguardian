import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { localDate } from '@bookguardian/shared';
import { en } from '@bookguardian/shared/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  describePeriod,
  hasBrowseFilter,
  languageName,
  monthBounds,
  monthLabel,
  yearBounds,
} from '../src/lib/stats';
import { installFakeApi, seedFakeApi, type FakeApi } from './fake-api';
import { renderApp } from './render';

let api: FakeApi;
let seed: ReturnType<typeof seedFakeApi>;

beforeEach(() => {
  api = installFakeApi();
  seed = seedFakeApi(api);
});
afterEach(() => {
  api.restore();
});

const user = () => userEvent.setup();

/** `YYYY-MM-DD` of the 10th, `monthsAgo` months back (local). */
function monthsAgo(monthsAgo: number): string {
  const d = new Date();
  return localDate(new Date(d.getFullYear(), d.getMonth() - monthsAgo, 10));
}

/** A small library with known counts. */
function seedLibrary() {
  const office = api.addLibrary('Office');
  const desk = api.addShelf(office.id, 'Desk');
  const dune = api.addBook({
    title: 'Dune',
    authors: ['Frank Herbert'],
    categories: ['Science fiction'],
    language: 'en',
    publisher: 'Chilton',
    pages: 412,
    rating: 5,
    readStatus: 'read',
    readAt: monthsAgo(0),
  });
  const messiah = api.addBook({
    title: 'Dune Messiah',
    authors: ['Frank Herbert'],
    categories: ['Science fiction'],
    language: 'en',
    pages: 256,
    rating: 4,
    readStatus: 'read',
    readAt: monthsAgo(1),
  });
  const soledad = api.addBook({
    title: 'Cien años de soledad',
    authors: ['Gabriel García Márquez'],
    categories: ['Fiction'],
    language: 'es',
    readStatus: 'reading',
    shelfId: desk.id,
  });
  const omens = api.addBook({
    title: 'Good Omens',
    authors: ['Terry Pratchett', 'Neil Gaiman'],
    categories: ['Fantasy', 'Fiction'],
    language: 'en',
    shelfId: desk.id,
  });
  api.addLending({ bookId: dune.id, borrowerName: 'Ana' });
  return { office, desk, dune, messiah, soledad, omens };
}

describe('stats helpers', () => {
  it('computes month and year bounds', () => {
    expect(monthBounds('2026-02')).toEqual({ readFrom: '2026-02-01', readTo: '2026-02-28' });
    expect(monthBounds('2024-02')).toEqual({ readFrom: '2024-02-01', readTo: '2024-02-29' });
    expect(monthBounds('2026-12')).toEqual({ readFrom: '2026-12-01', readTo: '2026-12-31' });
    expect(yearBounds('2025')).toEqual({ readFrom: '2025-01-01', readTo: '2025-12-31' });
  });

  it('names months, periods and languages in the given locale', () => {
    expect(monthLabel('2026-03', 'en')).toBe('Mar');
    expect(monthLabel('2026-03', 'en', 'long')).toBe('March 2026');
    expect(monthLabel('2026-03', 'es', 'long')).toMatch(/marzo de 2026/);
    expect(describePeriod('2026-03-01', '2026-03-31', 'en')).toBe('March 2026');
    expect(describePeriod('2025-01-01', '2025-12-31', 'en')).toBe('2025');
    expect(describePeriod('2025-01-01', '2025-06-30', 'en')).toBe('2025-01-01 – 2025-06-30');
    expect(describePeriod('2025-01-01', undefined, 'en')).toBe('2025-01-01 – …');
    expect(describePeriod(undefined, undefined, 'en')).toBeUndefined();
    expect(languageName('es', 'en')).toBe('Spanish');
    expect(languageName('en', 'es')).toBe('inglés');
    expect(languageName('zz-ZZ', 'en')).toBe('zz-ZZ');
  });

  it('hasBrowseFilter ignores the status and empty values', () => {
    expect(hasBrowseFilter({})).toBe(false);
    expect(hasBrowseFilter({ readStatus: 'read' })).toBe(false);
    expect(hasBrowseFilter({ category: 'Fantasy' })).toBe(true);
    expect(hasBrowseFilter({ readFrom: '2026-01-01' })).toBe(true);
  });
});

describe('Stats tab', () => {
  it('shows an empty state with a way to the library when there are no books', async () => {
    await renderApp('/stats');
    expect(
      await screen.findByRole('heading', { level: 1, name: en.stats.title }),
    ).toBeInTheDocument();
    expect(await screen.findByText(en.stats.empty.title)).toBeInTheDocument();
    expect(
      within(screen.getByRole('status')).getByRole('link', { name: en.nav.library }),
    ).toHaveAttribute('href', '/');
    expect(screen.queryByTestId('stat-tiles')).not.toBeInTheDocument();
  });

  it('shows the hero row, the donut and every breakdown with the right counts', async () => {
    const { office, desk, dune } = seedLibrary();
    await renderApp('/stats');
    const tiles = await screen.findByTestId('stat-tiles');
    expect(within(tiles).getByTestId('stat-tile-books')).toHaveTextContent('4Books');
    expect(within(tiles).getByTestId('stat-tile-read')).toHaveTextContent('2Read');
    expect(within(tiles).getByTestId('stat-tile-toRead')).toHaveTextContent('1To read');
    expect(within(tiles).getByTestId('stat-tile-lent')).toHaveTextContent('1Lent out');
    expect(within(tiles).getByTestId('stat-tile-read')).toHaveAttribute(
      'href',
      '/books?readStatus=read',
    );
    expect(within(tiles).getByTestId('stat-tile-lent')).toHaveAttribute('href', '/lending');
    expect(screen.getByText('668 pages on your shelves')).toBeInTheDocument();

    // Read status donut: every status in the legend, zero-count segments not drawn.
    const status = screen.getByTestId('stats-status');
    expect(within(status).getByTestId('legend-read')).toHaveTextContent('Read2');
    expect(within(status).getByTestId('legend-reading')).toHaveTextContent('Reading1');
    expect(within(status).getByTestId('legend-to_read')).toHaveTextContent('To read1');
    expect(within(status).getByTestId('legend-to_read')).toHaveAttribute(
      'href',
      '/books?readStatus=to_read',
    );
    expect(within(status).getAllByTestId(/donut-segment-/)).toHaveLength(3);
    expect(within(status).getByRole('img', { name: 'Books: 4' })).toBeInTheDocument();

    // Timeline: 24 columns, the tallest one carries its value.
    const timeline = screen.getByTestId('stats-timeline');
    expect(within(timeline).getByText('Last 24 months')).toBeInTheDocument();
    const columns = within(timeline).getAllByTestId('column');
    expect(columns).toHaveLength(24);
    expect(columns.at(-1)).toHaveAttribute(
      'aria-label',
      `${monthLabel(monthsAgo(0).slice(0, 7), 'en', 'long')}: 1 books`,
    );
    const thisMonth = monthBounds(monthsAgo(0).slice(0, 7));
    expect(columns.at(-1)).toHaveAttribute(
      'href',
      `/books?readFrom=${thisMonth.readFrom}&readTo=${thisMonth.readTo}`,
    );
    expect(within(timeline).getAllByText('1').length).toBeGreaterThanOrEqual(1);

    // Ratings: five columns and the unrated count.
    const ratings = screen.getByTestId('stats-ratings');
    expect(within(ratings).getAllByTestId('column')).toHaveLength(5);
    expect(within(ratings).getByText('2 books not rated yet')).toBeInTheDocument();
    expect(within(ratings).getByLabelText('5 stars: 1 books')).toHaveAttribute(
      'href',
      '/books?rating=5',
    );

    // Libraries and shelves link to their screens; shelves name their library.
    const libraries = screen.getByTestId('stats-libraries');
    expect(
      within(libraries)
        .getAllByTestId('bar-row')
        .map((r) => r.textContent),
    ).toEqual([`My Library2`, `Office2`]);
    expect(within(libraries).getByRole('link', { name: 'Office: 2 books' })).toHaveAttribute(
      'href',
      `/libraries/${office.id}`,
    );
    const shelves = screen.getByTestId('stats-shelves');
    expect(within(shelves).getByRole('link', { name: 'Desk · Office: 2 books' })).toHaveAttribute(
      'href',
      `/shelves/${desk.id}`,
    );

    // Categories, languages (named), authors, publishers.
    const categories = screen.getByTestId('stats-categories');
    expect(
      within(categories)
        .getAllByTestId('bar-row')
        .map((r) => r.textContent),
    ).toEqual(['Fiction2', 'Science fiction2', 'Fantasy1']);
    expect(
      within(categories).getByRole('link', { name: 'Science fiction: 2 books' }),
    ).toHaveAttribute('href', '/books?category=Science+fiction');
    const languages = screen.getByTestId('stats-languages');
    expect(
      within(languages)
        .getAllByTestId('bar-row')
        .map((r) => r.textContent),
    ).toEqual(['English3', 'Spanish1']);
    expect(within(languages).getByRole('link', { name: 'Spanish: 1 books' })).toHaveAttribute(
      'href',
      '/books?language=es',
    );
    const authors = screen.getByTestId('stats-authors');
    expect(within(authors).getAllByTestId('bar-row')[0]).toHaveTextContent('Frank Herbert2');
    expect(within(authors).getByRole('link', { name: 'Neil Gaiman: 1 books' })).toHaveAttribute(
      'href',
      '/books?author=Neil+Gaiman',
    );
    const publishers = screen.getByTestId('stats-publishers');
    expect(within(publishers).getAllByTestId('bar-row')).toHaveLength(1);
    expect(within(publishers).getByText('Chilton')).toBeInTheDocument();
    expect(dune.publisher).toBe('Chilton');
  });

  it('folds the tail of a breakdown into an unlinked "Other" row', async () => {
    for (let i = 0; i < 10; i += 1) {
      api.addBook({ title: `Book ${i}`, categories: ['Common', `Niche ${i}`] });
    }
    await renderApp('/stats');
    const categories = await screen.findByTestId('stats-categories');
    const rows = within(categories).getAllByTestId('bar-row');
    expect(rows).toHaveLength(9);
    expect(rows[0]).toHaveTextContent('Common10');
    expect(rows.at(-1)).toHaveTextContent('Other3');
    expect(within(rows.at(-1)!).queryByRole('link')).not.toBeInTheDocument();
  });

  it('hides single-row cards and shows "none yet" for empty ratings and timeline', async () => {
    api.addBook({ title: 'Only one' });
    await renderApp('/stats');
    await screen.findByTestId('stat-tiles');
    expect(screen.queryByTestId('stats-libraries')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stats-shelves')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stats-categories')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stats-years')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('stats-ratings')).getByText(en.stats.noneYet)).toBeVisible();
    expect(within(screen.getByTestId('stats-timeline')).getByText(en.stats.noneRead)).toBeVisible();
    expect(screen.queryByText(/pages on your shelves/)).not.toBeInTheDocument();
  });

  it('tapping a segment opens the filtered book list with a description and a way back', async () => {
    seedLibrary();
    await renderApp('/stats');
    const categories = await screen.findByTestId('stats-categories');
    await user().click(within(categories).getByRole('link', { name: 'Fantasy: 1 books' }));

    expect(await screen.findByRole('heading', { level: 1, name: en.books.all })).toBeVisible();
    expect(screen.getByText('Category · Fantasy')).toBeVisible();
    await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(1));
    expect(screen.getByTestId('book-card')).toHaveTextContent('Good Omens');
    expect(api.calls.some((c) => c.path.includes('category=Fantasy'))).toBe(true);
    expect(screen.getByRole('link', { name: en.common.back })).toHaveAttribute('href', '/stats');

    // The status chips still work on top of the drill-down.
    await user().click(screen.getByRole('button', { name: en.readStatus.read }));
    expect(await screen.findByText(en.books.empty.noResults)).toBeVisible();

    // "Show all books" drops the drill-down; the status chip the user picked stays.
    await user().click(screen.getByRole('link', { name: en.books.filtered.clear }));
    await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(2));
    await user().click(screen.getByRole('button', { name: en.readStatus.all }));
    await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(4));
    expect(screen.queryByText('Category · Fantasy')).not.toBeInTheDocument();
  });

  it('opens read books for a month and pre-selects the status from a hero tile', async () => {
    const { messiah } = seedLibrary();
    const lastMonth = monthsAgo(1).slice(0, 7);
    const bounds = monthBounds(lastMonth);
    await renderApp(`/books?readFrom=${bounds.readFrom}&readTo=${bounds.readTo}`);
    expect(await screen.findByText(`Read in ${monthLabel(lastMonth, 'en', 'long')}`)).toBeVisible();
    await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(1));
    expect(screen.getByTestId('book-card')).toHaveTextContent(messiah.title);
  });

  it('pre-selects the status chip from a hero tile link', async () => {
    seedLibrary();
    await renderApp('/books?readStatus=read');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: en.readStatus.read })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(2));
  });

  it('ignores malformed search params instead of failing', async () => {
    seedLibrary();
    await renderApp('/books?rating=9&readFrom=nope&readStatus=maybe');
    expect(await screen.findByRole('heading', { level: 1, name: en.books.all })).toBeVisible();
    await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(4));
    expect(screen.queryByRole('link', { name: en.books.filtered.clear })).not.toBeInTheDocument();
  });

  it('catches up after a book is marked read on its page (same session)', async () => {
    const { soledad } = seedLibrary();
    const { router } = await renderApp('/stats');
    expect(await screen.findByTestId('stat-tile-read')).toHaveTextContent('2Read');
    expect(seed.shelf.name).toBe('Default');

    await router.navigate({ to: '/books/$bookId', params: { bookId: soledad.id } });
    await user().click(await screen.findByRole('button', { name: en.readStatus.read }));
    await waitFor(() =>
      expect(api.books.find((b) => b.id === soledad.id)?.readStatus).toBe('read'),
    );

    // The mutation invalidated the stats query, so the tab refetches on return.
    await router.navigate({ to: '/stats' });
    await waitFor(() => expect(screen.getByTestId('stat-tile-read')).toHaveTextContent('3Read'));
  });
});
