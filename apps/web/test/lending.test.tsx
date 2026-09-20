import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { localDate, type LendingWithBook } from '@bookguardian/shared';
import { en } from '@bookguardian/shared/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { groupByBorrower, suggestBorrowers } from '../src/lib/lending';
import { installFakeApi, seedFakeApi, type FakeApi } from './fake-api';
import { renderApp } from './render';

let api: FakeApi;

beforeEach(() => {
  api = installFakeApi();
  seedFakeApi(api);
});
afterEach(() => {
  api.restore();
});

const user = () => userEvent.setup();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const dayFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
};

describe('Lending tab', () => {
  it('shows the empty state with a way back to the library', async () => {
    await renderApp('/lending');
    expect(
      await screen.findByRole('heading', { level: 1, name: en.lending.title }),
    ).toBeInTheDocument();
    expect(await screen.findByText(en.lending.empty.title)).toBeInTheDocument();
    expect(screen.getByText(en.lending.empty.body)).toBeInTheDocument();
    const tabbar = screen.getByTestId('tabbar');
    expect(within(tabbar).getByRole('link', { name: en.nav.lending })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(screen.getByRole('status')).getByRole('link', { name: en.nav.library }),
    ).toHaveAttribute('href', '/');
  });

  it('lists active lendings grouped by borrower with days out and overdue badges', async () => {
    const dune = api.addBook({ title: 'Dune' });
    api.setCover(dune.id, 'd'.repeat(64));
    const emma = api.addBook({ title: 'Emma' });
    const late = api.addBook({ title: 'Late one' });
    const back = api.addBook({ title: 'Returned already' });
    api.addLending({ bookId: dune.id, borrowerName: 'Ana', lentAt: daysAgo(3) });
    api.addLending({
      bookId: emma.id,
      borrowerName: 'ana',
      borrowerContact: 'ana@example.com',
      lentAt: daysAgo(0),
      dueAt: dayFromToday(7),
    });
    api.addLending({
      bookId: late.id,
      borrowerName: 'Bo',
      lentAt: daysAgo(30),
      dueAt: dayFromToday(-2),
    });
    api.addLending({
      bookId: back.id,
      borrowerName: 'Cy',
      lentAt: daysAgo(40),
      returnedAt: daysAgo(20),
    });

    await renderApp('/lending');
    expect(await screen.findByTestId('lending-summary')).toHaveTextContent(
      '3 books out · 1 overdue',
    );
    const groups = screen.getAllByTestId('borrower-group');
    expect(groups).toHaveLength(2);
    // Overdue borrowers first, then the most recent lending.
    expect(within(groups[0]!).getByRole('heading', { level: 2 })).toHaveTextContent('Bo');
    expect(within(groups[0]!).getByText(en.lending.overdue)).toHaveClass('pill--danger');
    expect(within(groups[0]!).getByText('30 days out')).toBeInTheDocument();

    // One borrower however the name was capitalised; the latest spelling and contact show.
    expect(within(groups[1]!).getByRole('heading', { level: 2 })).toHaveTextContent(
      /^ana\s*ana@example\.com$/,
    );
    const rows = within(groups[1]!).getAllByTestId('lending-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Emma');
    expect(rows[0]).toHaveTextContent(en.lending.outToday);
    expect(rows[0]).toHaveTextContent('Due');
    expect(rows[1]).toHaveTextContent('Dune');
    expect(rows[1]).toHaveTextContent('3 days out');
    expect(rows[1]!.querySelector('img')).toHaveAttribute(
      'src',
      `/api/covers/${'d'.repeat(64)}-thumb.webp`,
    );
    expect(within(rows[0]!).getByTestId('book-cover')).toHaveAttribute('data-state', 'placeholder');
    expect(screen.queryByText('Returned already')).not.toBeInTheDocument();
    expect(
      within(rows[1]!).getByRole('link', {
        name: en.lending.openBook.replace('{{title}}', 'Dune'),
      }),
    ).toHaveAttribute('href', `/books/${dune.id}`);
  });

  it('returns a book with one tap, optimistically, and rolls back on failure', async () => {
    const u = user();
    const dune = api.addBook({ title: 'Dune' });
    const emma = api.addBook({ title: 'Emma' });
    const lending = api.addLending({ bookId: dune.id, borrowerName: 'Ana' });
    api.addLending({ bookId: emma.id, borrowerName: 'Bo' });

    await renderApp('/lending');
    const rows = await screen.findAllByTestId('lending-row');
    expect(rows).toHaveLength(2);
    const duneRow = rows.find((r) => r.textContent?.includes('Dune'))!;

    await u.click(within(duneRow).getByRole('button', { name: en.lending.markReturned }));
    // Gone from the list right away, and the API is told.
    await waitFor(() => expect(screen.queryByText('Dune')).not.toBeInTheDocument());
    expect(await screen.findByText('“Dune” is back')).toBeInTheDocument();
    await waitFor(() => expect(lending.returnedAt).not.toBeNull());
    expect(
      api.calls.some((c) => c.method === 'POST' && c.path === `/api/lendings/${lending.id}/return`),
    ).toBe(true);
    expect(screen.getByTestId('lending-summary')).toHaveTextContent('1 book out');

    // The server refuses the next one: the row comes back.
    api.failNext({ method: 'POST', path: /\/return$/ }, 500);
    const emmaRow = screen.getByTestId('lending-row');
    await u.click(within(emmaRow).getByRole('button', { name: en.lending.markReturned }));
    expect(await screen.findByText(en.errors.saveFailed)).toBeInTheDocument();
    expect(await screen.findByText('Emma')).toBeInTheDocument();
    expect(api.lendings.filter((l) => l.returnedAt === null)).toHaveLength(1);
  });

  it('offers a retry when the API is unreachable', async () => {
    const u = user();
    api.failNext({ method: 'GET', path: /^\/api\/lendings$/ }, 503);
    api.addLending({ bookId: api.addBook({ title: 'Dune' }).id, borrowerName: 'Ana' });
    await renderApp('/lending');
    expect(await screen.findByText(en.errors.generic)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: en.common.retry }));
    expect(await screen.findByText('Dune')).toBeInTheDocument();
  });
});

describe('Book page lending', () => {
  it('lends a book from its page with a suggested borrower, then takes it back', async () => {
    const u = user();
    const dune = api.addBook({ title: 'Dune' });
    const old = api.addBook({ title: 'Older loan' });
    api.addLending({
      bookId: old.id,
      borrowerName: 'Ana',
      borrowerContact: '+34 600',
      lentAt: daysAgo(10),
      returnedAt: daysAgo(5),
    });
    api.addLending({ bookId: old.id, borrowerName: 'Bo', lentAt: daysAgo(2) });

    await renderApp(`/books/${dune.id}`);
    const panel = await screen.findByTestId('lending-panel');
    expect(within(panel).getByRole('heading', { level: 2 })).toHaveTextContent(en.lending.title);
    await u.click(await within(panel).findByRole('button', { name: en.lending.lend }));

    const sheet = await screen.findByRole('dialog', { name: 'Lend “Dune”' });
    // Recent borrowers as one-tap chips, most recent first.
    const chips = within(sheet).getByRole('group', { name: en.lending.recentBorrowers });
    expect(
      within(chips)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Bo', 'Ana']);
    // Typing narrows them; submitting without a name is refused.
    await u.click(within(sheet).getByRole('button', { name: en.lending.lend }));
    expect(within(sheet).getByRole('button', { name: en.lending.lend })).toBeDisabled();
    await u.type(within(sheet).getByLabelText(en.lending.field.borrower), 'an');
    expect(
      within(chips)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Ana']);
    await u.click(within(chips).getByRole('button', { name: 'Ana' }));
    expect(within(sheet).getByLabelText(en.lending.field.borrower)).toHaveValue('Ana');
    // Her last contact is filled in too, and the exact match is no longer suggested.
    expect(within(sheet).getByLabelText(/Contact or note/)).toHaveValue('+34 600');
    expect(within(sheet).queryByRole('group', { name: en.lending.recentBorrowers })).toBeNull();
    await u.type(within(sheet).getByLabelText(/Due back/), dayFromToday(14));
    await u.click(within(sheet).getByRole('button', { name: en.lending.lend }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await within(panel).findByText('Lent to Ana')).toBeInTheDocument();
    expect(within(panel).getByText('+34 600')).toBeInTheDocument();
    expect(within(panel).getByText(en.lending.outToday)).toBeInTheDocument();
    expect(within(panel).getByText(/^Due /)).toBeInTheDocument();
    await waitFor(() =>
      expect(api.lendings.find((l) => l.bookId === dune.id)).toMatchObject({
        borrowerName: 'Ana',
        borrowerContact: '+34 600',
        dueAt: dayFromToday(14),
        returnedAt: null,
      }),
    );
    const create = api.calls.find((c) => c.method === 'POST' && c.path === '/api/lendings');
    expect(create?.body).toEqual({
      bookId: dune.id,
      borrowerName: 'Ana',
      borrowerContact: '+34 600',
      dueAt: dayFromToday(14),
    });

    // One tap: it is back, and the loan moves into the history.
    await u.click(within(panel).getByRole('button', { name: en.lending.markReturned }));
    expect(await within(panel).findByRole('button', { name: en.lending.lend })).toBeInTheDocument();
    const history = within(panel).getByTestId('lending-history');
    expect(within(history).getAllByRole('listitem')).toHaveLength(1);
    expect(history).toHaveTextContent('Ana');
    await waitFor(() =>
      expect(api.lendings.find((l) => l.bookId === dune.id)?.returnedAt).not.toBeNull(),
    );
  });

  it('shows the current borrower with the overdue badge and lists past loans', async () => {
    const dune = api.addBook({ title: 'Dune' });
    api.addLending({
      bookId: dune.id,
      borrowerName: 'Ana',
      lentAt: daysAgo(60),
      returnedAt: daysAgo(50),
    });
    api.addLending({
      bookId: dune.id,
      borrowerName: 'Bo',
      lentAt: daysAgo(20),
      dueAt: dayFromToday(-1),
    });

    await renderApp(`/books/${dune.id}`);
    const panel = await screen.findByTestId('lending-panel');
    expect(await within(panel).findByText('Lent to Bo')).toBeInTheDocument();
    expect(within(panel).getByText('20 days out')).toBeInTheDocument();
    expect(within(panel).getByText(en.lending.overdue)).toHaveClass('pill--danger');
    expect(within(panel).getByText(en.lending.history)).toBeInTheDocument();
    const history = within(panel).getByTestId('lending-history');
    expect(within(history).getAllByRole('listitem')).toHaveLength(1);
    expect(history).toHaveTextContent('Ana');
    expect(history).not.toHaveTextContent('Bo');
  });

  it('rolls back a lend the server refuses and explains an already-lent book', async () => {
    const u = user();
    const dune = api.addBook({ title: 'Dune' });
    await renderApp(`/books/${dune.id}`);
    const panel = await screen.findByTestId('lending-panel');

    api.failNext({ method: 'POST', path: /^\/api\/lendings$/ }, 500);
    await u.click(await within(panel).findByRole('button', { name: en.lending.lend }));
    let sheet = await screen.findByRole('dialog');
    await u.type(within(sheet).getByLabelText(en.lending.field.borrower), 'Ana');
    await u.click(within(sheet).getByRole('button', { name: en.lending.lend }));
    expect(await screen.findByText(en.errors.saveFailed)).toBeInTheDocument();
    expect(await within(panel).findByRole('button', { name: en.lending.lend })).toBeInTheDocument();
    expect(api.lendings).toHaveLength(0);

    // Someone else lent it meanwhile (another device): the API says so.
    api.addLending({ bookId: dune.id, borrowerName: 'Bo' });
    await u.click(within(panel).getByRole('button', { name: en.lending.lend }));
    sheet = await screen.findByRole('dialog');
    await u.type(within(sheet).getByLabelText(en.lending.field.borrower), 'Ana');
    await u.click(within(sheet).getByRole('button', { name: en.lending.lend }));
    expect(await screen.findByText(en.lending.alreadyLent)).toBeInTheDocument();
    expect(await within(panel).findByText('Lent to Bo')).toBeInTheDocument();
  });
});

describe('Lent badge on covers', () => {
  it('marks lent books in the shelf grid and clears it after the return', async () => {
    const u = user();
    const dune = api.addBook({ title: 'Dune' });
    api.addBook({ title: 'Emma' });
    const lending = api.addLending({ bookId: dune.id, borrowerName: 'Ana' });

    await renderApp(`/shelves/${dune.shelfId}`);
    const cards = await screen.findAllByTestId('book-card');
    expect(cards).toHaveLength(2);
    const duneCard = cards.find((c) => c.textContent?.includes('Dune'))!;
    const emmaCard = cards.find((c) => c.textContent?.includes('Emma'))!;
    expect(await within(duneCard).findByText(en.lending.lent)).toHaveClass(
      'book-card__badge--lent',
    );
    expect(within(emmaCard).queryByText(en.lending.lent)).toBeNull();

    // Return it from the Lending tab; the badge is gone when we come back.
    const tabbar = screen.getByTestId('tabbar');
    await u.click(within(tabbar).getByRole('link', { name: en.nav.lending }));
    await u.click(await screen.findByRole('button', { name: en.lending.markReturned }));
    await waitFor(() => expect(lending.returnedAt).not.toBeNull());
    await u.click(within(tabbar).getByRole('link', { name: en.nav.library }));
    await u.click(await screen.findByRole('link', { name: /My Library/ }));
    await u.click(await screen.findByRole('link', { name: /Default/ }));
    const again = await screen.findAllByTestId('book-card');
    await waitFor(() =>
      expect(again.every((c) => within(c).queryByText(en.lending.lent) === null)).toBe(true),
    );
  });
});

describe('lending helpers', () => {
  const lending = (over: Partial<LendingWithBook>): LendingWithBook => ({
    id: over.id ?? 'x',
    ownerId: 'o',
    bookId: 'b',
    borrowerName: 'Ana',
    borrowerContact: null,
    lentAt: '2026-01-01T00:00:00.000Z',
    dueAt: null,
    returnedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    overdue: false,
    book: { id: 'b', title: 'T', authors: [], coverAssetId: null, coverUrl: null, shelfId: 's' },
    ...over,
  });

  it('groups by borrower ignoring case, overdue first, then most recent', () => {
    const groups = groupByBorrower([
      lending({ id: '1', borrowerName: 'Cy', lentAt: '2026-03-01T00:00:00.000Z' }),
      lending({ id: '2', borrowerName: 'Ana', lentAt: '2026-02-01T00:00:00.000Z' }),
      lending({
        id: '3',
        borrowerName: 'ana',
        borrowerContact: 'a@x',
        lentAt: '2026-01-01T00:00:00.000Z',
        overdue: true,
      }),
      lending({ id: '4', borrowerName: 'Bo', lentAt: '2026-02-15T00:00:00.000Z' }),
    ]);
    expect(groups.map((g) => [g.name, g.items.map((l) => l.id), g.overdue, g.contact])).toEqual([
      ['Ana', ['2', '3'], 1, 'a@x'],
      ['Cy', ['1'], 0, null],
      ['Bo', ['4'], 0, null],
    ]);
    expect(groupByBorrower([])).toEqual([]);
  });

  it('suggests borrowers by substring, capped, dropping the exact match', () => {
    const borrowers = ['Ana', 'Bo', 'Anabel', 'Cy', 'Dee', 'Eve', 'Fay', 'Gus'].map((name) => ({
      name,
      contact: null,
      lastLentAt: '2026-01-01T00:00:00.000Z',
    }));
    expect(suggestBorrowers(borrowers, '').map((b) => b.name)).toEqual([
      'Ana',
      'Bo',
      'Anabel',
      'Cy',
      'Dee',
      'Eve',
    ]);
    expect(suggestBorrowers(borrowers, 'AN').map((b) => b.name)).toEqual(['Ana', 'Anabel']);
    expect(suggestBorrowers(borrowers, 'ana ').map((b) => b.name)).toEqual(['Anabel']);
    expect(suggestBorrowers(borrowers, 'zzz')).toEqual([]);
  });
});
