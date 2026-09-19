import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { localDate } from '@bookguardian/shared';
import { en } from '@bookguardian/shared/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installFakeApi, seedFakeApi, type FakeApi } from './fake-api';
import { renderApp } from './render';

let api: FakeApi;
let seeded: ReturnType<typeof seedFakeApi>;

beforeEach(() => {
  api = installFakeApi();
  seeded = seedFakeApi(api);
});
afterEach(() => {
  api.restore();
});

const user = () => userEvent.setup();

describe('Library tab', () => {
  it('lists libraries with shelf and book counts and links into them', async () => {
    api.addBook({ title: 'Dune' });
    const office = api.addLibrary('Office', 'Desk');
    api.addShelf(office.id, 'Top');
    api.addShelf(office.id, 'Bottom');

    await renderApp('/');
    const list = await screen.findByTestId('library-list');
    const rows = within(list).getAllByRole('link');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('My Library');
    expect(rows[0]).toHaveTextContent('1 shelf · 1 book');
    expect(rows[1]).toHaveTextContent('Desk · 2 shelves · 0 books');

    await user().click(rows[1]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Office' })).toBeInTheDocument();
    expect(screen.getByText('Desk')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.nav.library })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('adds a book with only a title: tap +, type, save', async () => {
    const u = user();
    await renderApp('/');
    await screen.findByTestId('library-list');

    await u.click(screen.getByTestId('fab'));
    const sheet = await screen.findByRole('dialog', { name: en.books.add });
    expect(await within(sheet).findByTestId('shelf-label')).toHaveTextContent(
      'My Library › Default',
    );
    await u.type(within(sheet).getByLabelText(en.books.field.title), 'Dune');
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Added to My Library › Default')).toBeInTheDocument();
    await waitFor(() => expect(api.books.map((b) => b.title)).toEqual(['Dune']));
    const create = api.calls.find((c) => c.method === 'POST' && c.path === '/api/books');
    expect(create?.body).toMatchObject({ title: 'Dune', shelfId: seeded.shelf.id });
    // Counts refresh without a reload.
    await waitFor(() =>
      expect(screen.getByTestId('library-list')).toHaveTextContent('1 shelf · 1 book'),
    );
  });

  it('validates the form and lets the user pick a shelf and fill every field', async () => {
    const office = api.addLibrary('Office');
    const desk = api.addShelf(office.id, 'Desk');
    const u = user();
    await renderApp('/');
    await screen.findByTestId('library-list');
    await u.click(screen.getByTestId('fab'));
    const sheet = await screen.findByRole('dialog', { name: en.books.add });

    await u.click(within(sheet).getByRole('button', { name: en.common.save }));
    expect(await within(sheet).findByText(en.books.titleRequired)).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);

    await u.type(within(sheet).getByLabelText(en.books.field.title), 'Neuromancer');
    await u.click(within(sheet).getByRole('button', { name: en.books.more }));
    await u.type(within(sheet).getByLabelText(en.books.field.isbn), '12');
    await u.type(within(sheet).getByLabelText(en.books.field.coverUrl), 'nope');
    await u.type(within(sheet).getByLabelText(en.books.field.pages), '-3');
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));
    expect(await within(sheet).findByText(en.books.isbnInvalid)).toBeInTheDocument();
    expect(within(sheet).getByText(en.books.coverUrlInvalid)).toBeInTheDocument();
    expect(within(sheet).getByText(en.errors.validation)).toBeInTheDocument();

    await u.clear(within(sheet).getByLabelText(en.books.field.isbn));
    await u.type(within(sheet).getByLabelText(en.books.field.isbn), '978-0-441-56959-5');
    await u.clear(within(sheet).getByLabelText(en.books.field.coverUrl));
    await u.type(
      within(sheet).getByLabelText(en.books.field.coverUrl),
      'https://covers.example.com/n.jpg',
    );
    await u.clear(within(sheet).getByLabelText(en.books.field.pages));
    await u.type(within(sheet).getByLabelText(en.books.field.pages), '271');
    await u.type(within(sheet).getByLabelText(en.books.field.authors), 'William Gibson, ');
    await u.type(within(sheet).getByLabelText(en.books.field.publisher), 'Ace');
    await u.type(within(sheet).getByLabelText(en.books.field.year), '1984');
    await u.type(within(sheet).getByLabelText(en.books.field.language), 'en');
    await u.type(within(sheet).getByLabelText(en.books.field.categories), 'Sci-Fi,Cyberpunk');
    await u.type(within(sheet).getByLabelText(en.books.field.notes), 'Loaned once');

    await u.click(within(sheet).getByRole('button', { name: en.books.changeShelf }));
    await u.selectOptions(within(sheet).getByLabelText(en.books.shelf), desk.id);
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));

    await waitFor(() => expect(api.books).toHaveLength(1));
    expect(api.books[0]).toMatchObject({
      title: 'Neuromancer',
      shelfId: desk.id,
      isbn13: '9780441569595',
      isbn10: null,
      coverUrl: 'https://covers.example.com/n.jpg',
      pages: 271,
      authors: ['William Gibson'],
      publisher: 'Ace',
      publishedDate: '1984',
      language: 'en',
      categories: ['Sci-Fi', 'Cyberpunk'],
      notes: 'Loaned once',
    });
  });

  it('rolls back an optimistic add when the server rejects it', async () => {
    const u = user();
    await renderApp('/');
    await screen.findByTestId('library-list');
    api.failNext({ method: 'POST', path: /\/api\/books$/ });

    await u.click(screen.getByTestId('fab'));
    const sheet = await screen.findByRole('dialog');
    await within(sheet).findByText('My Library › Default');
    await u.type(within(sheet).getByLabelText(en.books.field.title), 'Ghost');
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));

    expect(await screen.findByText(en.errors.saveFailed)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('library-list')).toHaveTextContent('1 shelf · 0 books'),
    );
    expect(api.books).toHaveLength(0);
  });

  it('searches every book from the tab and shows an empty result state', async () => {
    api.addBook({ title: 'Dune', authors: ['Frank Herbert'] });
    api.addBook({ title: 'Emma', authors: ['Jane Austen'] });
    const u = user();
    await renderApp('/');
    await screen.findByTestId('library-list');

    await u.type(screen.getByRole('searchbox'), 'austen');
    const grid = await screen.findByTestId('book-grid');
    expect(within(grid).getAllByTestId('book-card')).toHaveLength(1);
    expect(grid).toHaveTextContent('Emma');
    expect(screen.queryByTestId('library-list')).not.toBeInTheDocument();

    await u.clear(screen.getByRole('searchbox'));
    await u.type(screen.getByRole('searchbox'), 'zzz');
    expect(await screen.findByText(en.books.empty.noResults)).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: en.common.clear }));
    expect(await screen.findByTestId('library-list')).toBeInTheDocument();
  });

  it('creates a new library from the header action', async () => {
    const u = user();
    await renderApp('/');
    await screen.findByTestId('library-list');
    await u.click(screen.getByRole('button', { name: en.library.addLibrary }));
    const sheet = await screen.findByRole('dialog', { name: en.library.addLibrary });
    expect(within(sheet).getByRole('button', { name: en.common.save })).toBeDisabled();
    await u.type(within(sheet).getByLabelText(en.library.name), 'Cabin');
    await u.type(within(sheet).getByLabelText(/Location/), 'Lake');
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));

    // Optimistically in the list, then persisted.
    expect(await screen.findByText('Cabin')).toBeInTheDocument();
    await waitFor(() => expect(api.libraries.map((l) => l.name)).toEqual(['My Library', 'Cabin']));
    expect(api.libraries[1]).toMatchObject({ location: 'Lake' });
  });

  it('shows the empty state when there are no libraries at all', async () => {
    api.libraries.length = 0;
    api.shelves.length = 0;
    await renderApp('/');
    expect(await screen.findByText(en.library.empty.title)).toBeInTheDocument();
  });

  it('offers a retry when the API is unreachable', async () => {
    api.failNext({ method: 'GET', path: /\/api\/libraries$/ });
    const u = user();
    await renderApp('/');
    expect(await screen.findByText(en.errors.generic)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: en.common.retry }));
    expect(await screen.findByTestId('library-list')).toBeInTheDocument();
  });
});

describe('Library detail', () => {
  it('lists shelves, manages them inline (add, rename, reorder, delete) and edits the library', async () => {
    const u = user();
    const office = api.addLibrary('Office', 'Desk');
    const top = api.addShelf(office.id, 'Top');
    const bottom = api.addShelf(office.id, 'Bottom');
    api.addBook({ title: 'On top', shelfId: top.id });

    await renderApp(`/libraries/${office.id}`);
    const list = await screen.findByTestId('shelf-list');
    expect(
      within(list)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Top1 book', 'Bottom0 books']);

    await u.click(screen.getByRole('button', { name: en.common.manage }));
    // Reorder: move Bottom up.
    await u.click(screen.getByRole('button', { name: `${en.common.moveUp}: Bottom` }));
    await waitFor(() =>
      expect(screen.getAllByTestId('shelf-row').map((r) => r.textContent)).toEqual([
        'Bottom0 books',
        'Top1 book',
      ]),
    );
    await waitFor(() =>
      expect(api.calls.some((c) => c.path === '/api/shelves/reorder')).toBe(true),
    );
    expect(api.shelves.find((s) => s.id === bottom.id)?.sortOrder).toBe(0);
    expect(screen.getByRole('button', { name: `${en.common.moveUp}: Bottom` })).toBeDisabled();
    expect(screen.getByRole('button', { name: `${en.common.moveDown}: Top` })).toBeDisabled();

    // Rename a shelf.
    await u.click(screen.getByRole('button', { name: `${en.common.edit}: Top` }));
    let sheet = await screen.findByRole('dialog', { name: en.library.editShelf });
    const nameField = within(sheet).getByLabelText(en.library.shelfName);
    expect(nameField).toHaveValue('Top');
    await u.clear(nameField);
    await u.type(nameField, 'Upper');
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));
    expect(await screen.findByText('Upper')).toBeInTheDocument();
    await waitFor(() => expect(api.shelves.find((s) => s.id === top.id)?.name).toBe('Upper'));

    // Add a shelf.
    await u.click(screen.getByRole('button', { name: en.library.addShelf }));
    sheet = await screen.findByRole('dialog', { name: en.library.addShelf });
    await u.type(within(sheet).getByLabelText(en.library.shelfName), 'Floor');
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));
    expect(await screen.findByText('Floor')).toBeInTheDocument();
    await waitFor(() =>
      expect(api.shelves.filter((s) => s.libraryId === office.id)).toHaveLength(3),
    );

    // Delete the empty shelf straight away.
    await u.click(screen.getByRole('button', { name: `${en.common.delete}: Floor` }));
    sheet = await screen.findByRole('dialog');
    await u.click(within(sheet).getByRole('button', { name: en.common.delete }));
    await waitFor(() => expect(screen.queryByText('Floor')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(api.shelves.filter((s) => s.libraryId === office.id)).toHaveLength(2),
    );

    // Delete a shelf that holds a book: must pick a destination.
    await u.click(screen.getByRole('button', { name: `${en.common.delete}: Upper` }));
    sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('button', { name: en.common.delete })).toBeDisabled();
    await u.selectOptions(within(sheet).getByLabelText(en.library.moveBooksTo), bottom.id);
    await u.click(within(sheet).getByRole('button', { name: en.common.delete }));
    await waitFor(() => expect(api.shelves.map((s) => s.name)).toEqual(['Default', 'Bottom']));
    expect(api.books[0]?.shelfId).toBe(bottom.id);
    await waitFor(() => expect(screen.getByTestId('shelf-list')).toHaveTextContent('Bottom1 book'));

    // The last shelf cannot be deleted.
    await u.click(screen.getByRole('button', { name: `${en.common.delete}: Bottom` }));
    sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(en.library.cannotDeleteLastShelf)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: en.common.delete })).toBeDisabled();
    await u.click(within(sheet).getByRole('button', { name: en.common.cancel }));

    // Edit the library itself.
    await u.click(screen.getByRole('button', { name: en.library.editLibrary }));
    sheet = await screen.findByRole('dialog', { name: en.library.editLibrary });
    const libName = within(sheet).getByLabelText(en.library.name);
    expect(libName).toHaveValue('Office');
    await u.clear(libName);
    await u.type(libName, 'Studio');
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Studio' })).toBeInTheDocument();
    await waitFor(() => expect(api.libraries[1]?.name).toBe('Studio'));

    await u.click(screen.getByRole('button', { name: en.common.done }));
    expect(screen.queryByTestId('shelf-row')).not.toBeInTheDocument();
  });

  it('deletes a library (moving its books) and returns to the tab', async () => {
    const u = user();
    const office = api.addLibrary('Office');
    const desk = api.addShelf(office.id, 'Desk');
    api.addBook({ title: 'Manual', shelfId: desk.id });

    await renderApp(`/libraries/${office.id}`);
    await screen.findByTestId('shelf-list');
    await u.click(screen.getByRole('button', { name: en.common.manage }));
    await u.click(screen.getByRole('button', { name: en.common.delete }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('button', { name: en.common.delete })).toBeDisabled();
    const picker = within(sheet).getByLabelText(en.library.moveBooksTo);
    expect(within(picker).queryByRole('option', { name: /Desk/ })).not.toBeInTheDocument();
    await u.selectOptions(picker, seeded.shelf.id);
    await u.click(within(sheet).getByRole('button', { name: en.common.delete }));

    expect(await screen.findByTestId('library-list')).toBeInTheDocument();
    await waitFor(() => expect(api.libraries.map((l) => l.name)).toEqual(['My Library']));
    expect(api.books[0]?.shelfId).toBe(seeded.shelf.id);
  });

  it('refuses to delete the only library and handles unknown ids', async () => {
    const u = user();
    await renderApp(`/libraries/${seeded.library.id}`);
    await screen.findByTestId('shelf-list');
    await u.click(screen.getByRole('button', { name: en.common.manage }));
    await u.click(screen.getByRole('button', { name: en.common.delete }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(en.library.cannotDeleteLast)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: en.common.delete })).toBeDisabled();
    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    cleanup();
    api.restore();
    api = installFakeApi();
    seedFakeApi(api);
    await renderApp('/libraries/00000000-0000-4000-8000-00000000dead');
    expect(
      await screen.findByRole('heading', { level: 1, name: en.errors.notFound }),
    ).toBeInTheDocument();
  });

  it('shows the shelves empty state and rolls back a failed rename', async () => {
    const u = user();
    const bare = api.addLibrary('Bare');
    await renderApp(`/libraries/${bare.id}`);
    expect(await screen.findByText(en.library.shelvesEmpty.title)).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: en.common.manage }));
    api.failNext({ method: 'PATCH' });
    await u.click(screen.getByRole('button', { name: en.library.editLibrary }));
    const sheet = await screen.findByRole('dialog');
    const name = within(sheet).getByLabelText(en.library.name);
    await u.clear(name);
    await u.type(name, 'Renamed');
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));
    expect(await screen.findByText(en.errors.saveFailed)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Bare' })).toBeInTheDocument();
    expect(api.libraries.find((l) => l.id === bare.id)?.name).toBe('Bare');
  });
});

describe('Shelf screen', () => {
  it('shows the cover-first grid, filters by status and search, and adds onto this shelf', async () => {
    const u = user();
    const other = api.addShelf(seeded.library.id, 'Other');
    api.addBook({ title: 'Dune', authors: ['Frank Herbert'], readStatus: 'read' });
    api.addBook({
      title: 'Emma',
      authors: ['Jane Austen'],
      coverUrl: 'https://covers.example.com/emma.jpg',
    });
    api.addBook({ title: 'Elsewhere', shelfId: other.id });

    await renderApp(`/shelves/${seeded.shelf.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Default' })).toBeInTheDocument();
    expect(screen.getByText('My Library')).toBeInTheDocument();
    const grid = await screen.findByTestId('book-grid');
    expect(within(grid).getAllByTestId('book-card')).toHaveLength(2);
    const emma = within(grid).getByRole('link', { name: 'Emma — Jane Austen' });
    expect(emma.querySelector('img')).toHaveAttribute('src', 'https://covers.example.com/emma.jpg');
    const dune = within(grid).getByRole('link', { name: 'Dune — Frank Herbert' });
    expect(dune).toHaveTextContent(en.readStatus.read);
    expect(dune.querySelector('img')).toBeNull();
    expect(screen.getByText('Showing 2 of 2')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: en.readStatus.read }));
    await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(1));
    expect(screen.getByTestId('book-grid')).toHaveTextContent('Dune');

    await u.click(screen.getByRole('button', { name: en.readStatus.all }));
    await u.type(screen.getByRole('searchbox'), 'nothing');
    expect(await screen.findByText(en.books.empty.noResults)).toBeInTheDocument();
    await u.clear(screen.getByRole('searchbox'));

    await u.click(screen.getByTestId('fab'));
    const sheet = await screen.findByRole('dialog');
    expect(await within(sheet).findByTestId('shelf-label')).toHaveTextContent('Default');
    await u.type(within(sheet).getByLabelText(en.books.field.title), 'New here');
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));
    await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(3));
    expect(screen.getAllByTestId('book-card')[0]).toHaveTextContent('New here');
    await waitFor(() =>
      expect(api.books.at(-1)).toMatchObject({ title: 'New here', shelfId: seeded.shelf.id }),
    );
  });

  it('has an empty state with an add button, and a not-found state', async () => {
    const u = user();
    await renderApp(`/shelves/${seeded.shelf.id}`);
    expect(await screen.findByText(en.books.empty.title)).toBeInTheDocument();
    await u.click(within(screen.getByRole('status')).getByRole('button', { name: en.books.add }));
    expect(await screen.findByRole('dialog', { name: en.books.add })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: en.common.close }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    cleanup();
    api.restore();
    api = installFakeApi();
    seedFakeApi(api);
    await renderApp('/shelves/00000000-0000-4000-8000-00000000dead');
    expect(
      await screen.findByRole('heading', { level: 1, name: en.errors.notFound }),
    ).toBeInTheDocument();
  });

  it('pages through long shelves with "load more"', async () => {
    for (let i = 0; i < 70; i += 1) api.addBook({ title: `Book ${i}` });
    const u = user();
    await renderApp(`/shelves/${seeded.shelf.id}`);
    await screen.findByTestId('book-grid');
    await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(60));
    expect(screen.getByText('Showing 60 of 70')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: en.books.loadMore }));
    await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(70));
    expect(screen.queryByRole('button', { name: en.books.loadMore })).not.toBeInTheDocument();
  });
});

describe('Book detail', () => {
  it('renders metadata, toggles read status, moves, edits and deletes', async () => {
    const u = user();
    const other = api.addShelf(seeded.library.id, 'Other');
    const book = api.addBook({
      title: 'Dune',
      subtitle: 'Book one',
      authors: ['Frank Herbert'],
      publisher: 'Ace',
      publishedDate: '1965',
      pages: 412,
      language: 'en',
      isbn13: '9780441013593',
      categories: ['Sci-Fi'],
      rating: 4,
      description: 'Desert planet.',
      notes: 'Gift',
      coverUrl: 'https://covers.example.com/dune.jpg',
    });

    await renderApp(`/books/${book.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Dune' })).toBeInTheDocument();
    expect(screen.getByText('Frank Herbert')).toBeInTheDocument();
    expect(screen.getByText('Book one')).toBeInTheDocument();
    expect(screen.getByText('Published 1965 · 412 pages')).toBeInTheDocument();
    expect(screen.getByLabelText('4 of 5')).toBeInTheDocument();
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument();
    expect(screen.getByText('Ace')).toBeInTheDocument();
    expect(screen.getByText('9780441013593')).toBeInTheDocument();
    expect(screen.getByText('Desert planet.')).toBeInTheDocument();
    expect(screen.getByText('Gift')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('book-shelf')).toHaveTextContent('My Library › Default'),
    );

    // Quick status toggle (optimistic): "Read" stamps today, editable in place.
    await u.click(screen.getByRole('button', { name: en.readStatus.read }));
    expect(screen.getByRole('button', { name: en.readStatus.read })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const readAt = screen.getByLabelText(en.books.field.readAt);
    expect(readAt).toHaveValue(localDate());
    await waitFor(() => expect(api.books[0]?.readStatus).toBe('read'));
    expect(api.books[0]?.readAt).toBe(localDate());

    // Move to another shelf.
    await u.click(screen.getByRole('button', { name: en.common.move }));
    let sheet = await screen.findByRole('dialog', { name: en.books.moveToShelf });
    expect(within(sheet).getByRole('button', { name: en.common.move })).toBeDisabled();
    await u.selectOptions(within(sheet).getByLabelText(en.books.shelf), other.id);
    await u.click(within(sheet).getByRole('button', { name: en.common.move }));
    await waitFor(() =>
      expect(screen.getByTestId('book-shelf')).toHaveTextContent('My Library › Other'),
    );
    await waitFor(() => expect(api.books[0]?.shelfId).toBe(other.id));

    // Edit.
    await u.click(screen.getByRole('button', { name: en.common.edit }));
    sheet = await screen.findByRole('dialog', { name: en.books.edit });
    const title = within(sheet).getByLabelText(en.books.field.title);
    expect(title).toHaveValue('Dune');
    expect(within(sheet).getByLabelText(en.books.field.isbn)).toHaveValue('9780441013593');
    await u.clear(title);
    await u.type(title, 'Dune Messiah');
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dune Messiah' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.books[0]?.title).toBe('Dune Messiah'));
    expect(api.books[0]).toMatchObject({ pages: 412, categories: ['Sci-Fi'], shelfId: other.id });

    // Delete → back to the shelf.
    await u.click(screen.getByRole('button', { name: en.common.delete }));
    sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Delete “Dune Messiah”?')).toBeInTheDocument();
    await u.click(within(sheet).getByRole('button', { name: en.common.delete }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Other' })).toBeInTheDocument();
    expect(await screen.findByText(en.books.deleted)).toBeInTheDocument();
    await waitFor(() => expect(api.books).toHaveLength(0));
  });

  it('lets the user correct the finish date and clears it when the book is un-read', async () => {
    const u = user();
    const book = api.addBook({ title: 'Dune' });
    await renderApp(`/books/${book.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Dune' });
    expect(screen.queryByLabelText(en.books.field.readAt)).not.toBeInTheDocument();

    // Mark as read → today, then pick an earlier day in the same row.
    await u.click(screen.getByRole('button', { name: en.readStatus.read }));
    const readAt = await screen.findByLabelText(en.books.field.readAt);
    expect(readAt).toHaveValue(localDate());
    expect(readAt).toHaveAttribute('max', localDate());
    await waitFor(() => expect(api.books[0]?.readAt).toBe(localDate()));

    fireEvent.change(readAt, { target: { value: '2024-03-10' } });
    expect(readAt).toHaveValue('2024-03-10'); // optimistic
    await waitFor(() => expect(api.books[0]?.readAt).toBe('2024-03-10'));
    const patch = api.calls.filter((c) => c.method === 'PATCH').at(-1);
    expect(patch?.body).toEqual({ readStatus: 'read', readAt: '2024-03-10' });

    // Future days never reach the API.
    fireEvent.change(readAt, { target: { value: '2999-01-01' } });
    expect(await screen.findByText(en.books.readAtFuture)).toBeInTheDocument();
    expect(api.calls.filter((c) => c.method === 'PATCH')).toHaveLength(2);
    expect(api.books[0]?.readAt).toBe('2024-03-10');

    // Reload: the corrected day is what comes back.
    cleanup();
    await renderApp(`/books/${book.id}`);
    expect(await screen.findByLabelText(en.books.field.readAt)).toHaveValue('2024-03-10');

    // Back to "reading" clears the date and hides the row.
    await u.click(screen.getByRole('button', { name: en.readStatus.reading }));
    await waitFor(() =>
      expect(screen.queryByLabelText(en.books.field.readAt)).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(api.books[0]).toMatchObject({ readStatus: 'reading', readAt: null }),
    );
  });

  it('rolls back the finish date when the save fails', async () => {
    const book = api.addBook({ title: 'Dune', readStatus: 'read', readAt: '2020-01-15' });
    await renderApp(`/books/${book.id}`);
    const readAt = await screen.findByLabelText(en.books.field.readAt);
    expect(readAt).toHaveValue('2020-01-15');

    api.failNext({ method: 'PATCH' }, 422);
    fireEvent.change(readAt, { target: { value: '2019-05-05' } });
    expect(readAt).toHaveValue('2019-05-05');
    expect(await screen.findByText(en.errors.saveFailed)).toBeInTheDocument();
    await waitFor(() => expect(readAt).toHaveValue('2020-01-15'));
    expect(api.books[0]?.readAt).toBe('2020-01-15');
  });

  it('shows a not-found state for a missing book and rolls back a failed delete', async () => {
    await renderApp('/books/00000000-0000-4000-8000-00000000dead');
    expect(await screen.findByText(en.books.detail.notFound)).toBeInTheDocument();

    cleanup();
    api.restore();
    api = installFakeApi();
    seedFakeApi(api);
    const book = api.addBook({ title: 'Sticky' });
    const u = user();
    await renderApp(`/books/${book.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Sticky' });
    api.failNext({ method: 'DELETE' });
    await u.click(screen.getByRole('button', { name: en.common.delete }));
    const sheet = await screen.findByRole('dialog');
    await u.click(within(sheet).getByRole('button', { name: en.common.delete }));
    expect(await screen.findByText(en.errors.deleteFailed)).toBeInTheDocument();
    expect(api.books).toHaveLength(1);
  });
});
