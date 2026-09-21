import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { en } from '@bookguardian/shared/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACTION_WIDTH } from '../src/components/SwipeRow';
import { BOOK_VIEW_KEY } from '../src/lib/book-view';
import { getLastOpened, markOpened } from '../src/lib/last-opened';
import { installFakeApi, seedFakeApi, type FakeApi } from './fake-api';
import { renderApp } from './render';

let api: FakeApi;
let seeded: ReturnType<typeof seedFakeApi>;

beforeEach(() => {
  api = installFakeApi();
  seeded = seedFakeApi(api);
  localStorage.clear();
  markOpened(null);
});
afterEach(() => {
  api.restore();
});

const user = () => userEvent.setup();

/** A finger swiping a row's content to the left by `px`. */
function swipeLeft(row: HTMLElement, px: number) {
  const content = row.querySelector('.swipe__content')!;
  const finger = (type: string, x: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 10 });
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(content, event);
  };
  finger('pointerdown', 300);
  finger('pointermove', 300 - px);
  finger('pointerup', 300 - px);
}

describe('Book list view', () => {
  it('switches between grid and rows, remembers the choice, and shows badges on rows', async () => {
    api.addBook({ title: 'Dune', authors: ['Frank Herbert'], rating: 4, readStatus: 'read' });
    const emma = api.addBook({ title: 'Emma', authors: ['Jane Austen'] });
    api.addLending({ bookId: emma.id, borrowerName: 'Ana' });
    const u = user();
    await renderApp(`/shelves/${seeded.shelf.id}`);
    await screen.findByTestId('book-grid');
    expect(screen.getByText(en.reading.longPressHint)).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: en.books.view.list }));
    const rows = await screen.findByTestId('book-rows');
    expect(screen.queryByTestId('book-grid')).not.toBeInTheDocument();
    expect(localStorage.getItem(BOOK_VIEW_KEY)).toBe('list');
    expect(screen.getByText(en.quick.swipeHint)).toBeInTheDocument();
    const items = within(rows).getAllByTestId('book-row');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Emma');
    expect(items[0]).toHaveTextContent(en.lending.lent);
    expect(items[1]).toHaveTextContent('Dune');
    expect(items[1]).toHaveTextContent(en.readStatus.read);
    expect(within(items[1]!).getByLabelText('4 stars')).toBeInTheDocument();

    // The preference survives a reload of the screen.
    await u.click(screen.getByRole('link', { name: en.nav.library }));
    await screen.findByTestId('library-list');
    await u.click(screen.getByRole('link', { name: /My Library/ }));
    await u.click(await screen.findByRole('link', { name: /Default/ }));
    expect(await screen.findByTestId('book-rows')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: en.books.view.grid }));
    expect(await screen.findByTestId('book-grid')).toBeInTheDocument();
  });

  it('marks a book read from a swipe, and unread again', async () => {
    localStorage.setItem(BOOK_VIEW_KEY, 'list');
    api.addBook({ title: 'Dune' });
    await renderApp(`/shelves/${seeded.shelf.id}`);
    const row = await screen.findByTestId('book-row');
    expect(row).not.toHaveTextContent(en.readStatus.read);

    swipeLeft(row, 3 * ACTION_WIDTH);
    expect(row).toHaveAttribute('data-open', 'true');
    fireEvent.click(within(row).getByRole('button', { name: en.quick.markRead }));
    await waitFor(() => expect(api.books[0]?.readStatus).toBe('read'));
    expect(row).toHaveTextContent(en.readStatus.read);
    expect(row).not.toHaveAttribute('data-open');

    swipeLeft(row, 3 * ACTION_WIDTH);
    fireEvent.click(within(row).getByRole('button', { name: en.quick.markUnread }));
    await waitFor(() => expect(api.books[0]?.readStatus).toBe('to_read'));
  });

  it('lends from a swipe, returns from the next one, and moves through the picker', async () => {
    localStorage.setItem(BOOK_VIEW_KEY, 'list');
    const u = user();
    api.addBook({ title: 'Dune' });
    const shelf = api.addShelf(seeded.library.id, 'Top');
    await renderApp(`/shelves/${seeded.shelf.id}`);
    const row = await screen.findByTestId('book-row');

    swipeLeft(row, 3 * ACTION_WIDTH);
    fireEvent.click(within(row).getByRole('button', { name: en.quick.lend }));
    const lend = await screen.findByRole('dialog', {
      name: en.lending.lendTitle.replace('{{title}}', 'Dune'),
    });
    await u.type(within(lend).getByLabelText(en.lending.field.borrower), 'Ana');
    await u.click(within(lend).getByRole('button', { name: en.lending.lend }));
    await waitFor(() => expect(api.lendings).toHaveLength(1));
    await waitFor(() => expect(row).toHaveTextContent(en.lending.lent));

    swipeLeft(row, 3 * ACTION_WIDTH);
    fireEvent.click(within(row).getByRole('button', { name: en.quick.return }));
    await waitFor(() => expect(api.lendings[0]?.returnedAt).not.toBeNull());
    await waitFor(() => expect(row).not.toHaveTextContent(en.lending.lent));

    swipeLeft(row, 3 * ACTION_WIDTH);
    fireEvent.click(within(row).getByRole('button', { name: en.quick.move }));
    const move = await screen.findByRole('dialog', { name: en.books.moveToShelf });
    await u.selectOptions(within(move).getByLabelText(en.books.shelf), shelf.id);
    await u.click(within(move).getByRole('button', { name: en.common.move }));
    await waitFor(() => expect(api.books[0]?.shelfId).toBe(shelf.id));
    expect(await screen.findByText('Moved to My Library › Top')).toBeInTheDocument();
    // Gone from this shelf's list.
    await waitFor(() => expect(screen.queryByTestId('book-row')).not.toBeInTheDocument());
  });

  it('exposes the same actions through the "more" button and the quick actions sheet', async () => {
    localStorage.setItem(BOOK_VIEW_KEY, 'list');
    const u = user();
    api.addBook({ title: 'Dune', authors: ['Frank Herbert'] });
    await renderApp(`/shelves/${seeded.shelf.id}`);
    const row = await screen.findByTestId('book-row');
    await u.click(within(row).getByRole('button', { name: `${en.quick.more}: Dune` }));
    const sheet = await screen.findByRole('dialog', { name: 'Dune' });
    expect(within(sheet).getByText('Frank Herbert')).toBeInTheDocument();
    await u.click(within(sheet).getByRole('button', { name: en.quick.move }));
    expect(await screen.findByRole('dialog', { name: en.books.moveToShelf })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: en.common.close }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await u.click(within(row).getByRole('button', { name: `${en.quick.more}: Dune` }));
    await u.click(
      within(await screen.findByRole('dialog', { name: 'Dune' })).getByRole('button', {
        name: en.quick.lend,
      }),
    );
    expect(
      await screen.findByRole('dialog', {
        name: en.lending.lendTitle.replace('{{title}}', 'Dune'),
      }),
    ).toBeInTheDocument();
  });

  it('remembers the book a row opened, so the cover can morph back on return', async () => {
    localStorage.setItem(BOOK_VIEW_KEY, 'list');
    const u = user();
    const dune = api.addBook({ title: 'Dune' });
    await renderApp(`/shelves/${seeded.shelf.id}`);
    const row = await screen.findByTestId('book-row');
    expect(getLastOpened()).toBeNull();
    await u.click(within(row).getByRole('link', { name: /Dune/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dune' })).toBeInTheDocument();
    expect(getLastOpened()).toBe(dune.id);
    // The hero cover carries the shared name via its class; the row will pick it up on the way back.
    await u.click(screen.getByRole('link', { name: en.common.back }));
    const back = await screen.findByTestId('book-row');
    expect(back.querySelector<HTMLElement>('.book-row__cover')?.style.viewTransitionName).toBe(
      'book-cover',
    );
  });
});

describe('Book grid', () => {
  it('gives the last-opened cover the shared transition name', async () => {
    const u = user();
    const dune = api.addBook({ title: 'Dune' });
    api.addBook({ title: 'Emma' });
    await renderApp(`/shelves/${seeded.shelf.id}`);
    const grid = await screen.findByTestId('book-grid');
    const cover = (title: string) =>
      within(grid)
        .getByRole('link', { name: new RegExp(title) })
        .querySelector<HTMLElement>('.book-card__cover')!;
    expect(cover('Dune').style.viewTransitionName).toBe('');
    await u.click(within(grid).getByRole('link', { name: /Dune/ }));
    await screen.findByRole('heading', { level: 1, name: 'Dune' });
    expect(getLastOpened()).toBe(dune.id);
    await u.click(screen.getByRole('link', { name: en.common.back }));
    await screen.findByTestId('book-grid');
    expect(cover('Dune').style.viewTransitionName).toBe('book-cover');
    expect(cover('Emma').style.viewTransitionName).toBe('');
  });
});
