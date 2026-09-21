import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BookDraft } from '@bookguardian/shared';
import { en } from '@bookguardian/shared/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { searchParamsFor } from '../src/api/lookup';
import { EMPTY_BOOK_FORM, mergeDraftIntoForm, searchFieldsOf } from '../src/lib/book-form';
import { installFakeApi, seedFakeApi, type FakeApi } from './fake-api';
import { renderApp } from './render';

const DUNE: BookDraft = {
  isbn10: '0441013597',
  isbn13: '9780441013593',
  title: 'Dune',
  subtitle: 'Deluxe Edition',
  authors: ['Frank Herbert'],
  publisher: 'Ace Books',
  publishedDate: '2005',
  pages: 528,
  language: 'en',
  coverUrl: 'https://covers.example.com/dune.jpg',
  categories: ['Science fiction'],
  description: 'Set on the desert planet Arrakis.',
  source: 'open_library',
  sourceId: '/books/OL1M',
};
const MESSIAH: BookDraft = {
  ...DUNE,
  isbn10: '0441172695',
  isbn13: '9780441172696',
  title: 'Dune Messiah',
  subtitle: null,
  publishedDate: '1969',
  pages: 331,
  description: null,
  source: 'google_books',
  sourceId: 'g2',
};
const NO_ISBN: BookDraft = {
  ...DUNE,
  isbn10: null,
  isbn13: null,
  title: 'Dune (fan edition)',
  sourceId: null,
};

describe('search fields of a half-filled form', () => {
  it('sends every searchable field with text, the year as four digits, a valid ISBN only', () => {
    expect(searchFieldsOf(EMPTY_BOOK_FORM)).toEqual({});
    expect(
      searchFieldsOf({
        ...EMPTY_BOOK_FORM,
        title: ' Dune ',
        authors: 'Frank Herbert',
        isbn: '0-441-01359-7',
        publisher: 'Ace',
        year: 'August 1, 1978',
        notes: 'not searchable',
      }),
    ).toEqual({
      title: 'Dune',
      author: 'Frank Herbert',
      isbn: '9780441013593',
      publisher: 'Ace',
      year: '1978',
    });
    // A mistyped ISBN or a year without four digits is left out rather than sinking the search.
    expect(searchFieldsOf({ ...EMPTY_BOOK_FORM, isbn: '12', year: '65' })).toEqual({});
    expect(searchParamsFor({ title: 'Dune', author: ' ', isbn: '' }, 10).toString()).toBe(
      'title=Dune&limit=10',
    );
    expect(searchParamsFor('dune herbert', 5).toString()).toBe('q=dune+herbert&limit=5');
  });
});

describe('merging a picked result into the form', () => {
  it('fills empty fields, keeps typed ones and suggests the online value where they differ', () => {
    const { values, suggestions } = mergeDraftIntoForm(
      { ...EMPTY_BOOK_FORM, title: 'dune', authors: 'F. Herbert', year: '2005', notes: 'mine' },
      DUNE,
    );
    expect(values).toEqual({
      title: 'dune',
      authors: 'F. Herbert',
      isbn: '9780441013593',
      subtitle: 'Deluxe Edition',
      publisher: 'Ace Books',
      year: '2005',
      pages: '528',
      language: 'en',
      categories: 'Science fiction',
      coverUrl: '',
      description: 'Set on the desert planet Arrakis.',
      notes: 'mine',
    });
    // Same text, different case/spacing: no chip. Different text: a chip.
    expect(suggestions).toEqual({ authors: 'Frank Herbert' });
  });

  it('always takes the result ISBN and uses the provider cover only when there is no ISBN', () => {
    const typed = { ...EMPTY_BOOK_FORM, isbn: '9780441172696' };
    expect(mergeDraftIntoForm(typed, DUNE).values.isbn).toBe('9780441013593');
    expect(mergeDraftIntoForm(typed, DUNE).values.coverUrl).toBe('');
    // No ISBN to resolve a cover by: hand the API the provider image instead.
    const fan = mergeDraftIntoForm(typed, NO_ISBN);
    expect(fan.values.isbn).toBe('9780441172696');
    expect(fan.values.coverUrl).toBe('https://covers.example.com/dune.jpg');
    // …unless the user pasted a cover URL already.
    expect(
      mergeDraftIntoForm({ ...typed, coverUrl: 'https://mine.example/c.jpg' }, NO_ISBN).values
        .coverUrl,
    ).toBe('https://mine.example/c.jpg');
    // Blank result fields never suggest anything.
    expect(mergeDraftIntoForm({ ...EMPTY_BOOK_FORM, subtitle: 'x' }, MESSIAH).suggestions).toEqual(
      {},
    );
  });
});

describe('Add book → Search online', () => {
  let api: FakeApi;
  beforeEach(() => {
    api = installFakeApi();
    seedFakeApi(api);
  });
  afterEach(() => {
    api.restore();
  });

  const user = () => userEvent.setup();

  async function openForm() {
    await renderApp('/');
    await screen.findByTestId('library-list');
    await user().click(screen.getByTestId('fab'));
    const sheet = await screen.findByRole('dialog', { name: en.books.add });
    await within(sheet).findByTestId('shelf-label');
    return sheet;
  }

  it('searches with the typed fields, fills the form from the pick and keeps typed values with chips', async () => {
    api.searchResults = [DUNE, MESSIAH];
    const u = user();
    const sheet = await openForm();
    const button = within(sheet).getByTestId('search-online');
    expect(button).toBeDisabled();

    await u.type(within(sheet).getByLabelText(en.books.field.title), 'Dune');
    await u.type(within(sheet).getByLabelText(en.books.field.authors), 'F. Herbert');
    expect(button).toBeEnabled();
    await u.click(button);

    const results = await screen.findByRole('dialog', { name: en.books.search.title });
    const rows = within(await within(results).findByTestId('results')).getAllByTestId('result');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName('Use “Dune”');
    expect(rows[0]).toHaveTextContent('Dune — Deluxe Edition');
    expect(rows[0]).toHaveTextContent('Frank Herbert');
    expect(rows[0]).toHaveTextContent('Ace Books · 2005');
    expect(rows[0]).toHaveTextContent('ISBN 9780441013593');
    expect(rows[0]).toHaveTextContent('Open Library');
    expect(rows[1]).toHaveTextContent('Google Books');
    const search = api.calls.find((c) => c.path.startsWith('/api/lookup/search'));
    expect(search?.path).toBe('/api/lookup/search?title=Dune&author=F.+Herbert&limit=10');

    await u.click(rows[0]!);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: en.books.search.title })).not.toBeInTheDocument(),
    );
    // Typed fields stay, empty ones are filled, details are expanded to show them.
    expect(within(sheet).getByLabelText(en.books.field.title)).toHaveValue('Dune');
    expect(within(sheet).getByLabelText(en.books.field.authors)).toHaveValue('F. Herbert');
    expect(within(sheet).getByLabelText(en.books.field.isbn)).toHaveValue('9780441013593');
    expect(within(sheet).getByLabelText(en.books.field.subtitle)).toHaveValue('Deluxe Edition');
    expect(within(sheet).getByLabelText(en.books.field.publisher)).toHaveValue('Ace Books');
    expect(within(sheet).getByLabelText(en.books.field.pages)).toHaveValue('528');
    expect(within(sheet).getByTestId('filled-from')).toHaveTextContent('Filled from Open Library');

    // One chip, for the one field that disagreed; tapping it takes the online value.
    const chip = within(sheet).getByTestId('suggestion-authors');
    expect(chip).toHaveTextContent('Use online value: Frank Herbert');
    expect(within(sheet).queryByTestId('suggestion-title')).not.toBeInTheDocument();
    await u.click(chip);
    expect(within(sheet).getByLabelText(en.books.field.authors)).toHaveValue('Frank Herbert');
    expect(within(sheet).queryByTestId('suggestion-authors')).not.toBeInTheDocument();

    // Save as usual: default shelf, the merged payload, no extra taps.
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));
    await waitFor(() => expect(api.books).toHaveLength(1));
    expect(api.books[0]).toMatchObject({
      title: 'Dune',
      authors: ['Frank Herbert'],
      isbn13: '9780441013593',
      subtitle: 'Deluxe Edition',
      pages: 528,
    });
  });

  it('searches on Enter from a searchable field and clips long chips', async () => {
    api.searchResults = [{ ...DUNE, description: 'x'.repeat(120) }];
    const u = user();
    const sheet = await openForm();
    await u.type(within(sheet).getByLabelText(en.books.field.title), 'Dune{Enter}');
    const results = await screen.findByRole('dialog', { name: en.books.search.title });
    expect(api.books).toHaveLength(0); // Enter searched, it did not save
    await u.click(within(results).getAllByTestId('result')[0]!);
    expect(within(sheet).getByLabelText(en.books.field.description)).toHaveValue('x'.repeat(120));

    // A field the user filled differently after "More details" gets a clipped chip.
    await u.clear(within(sheet).getByLabelText(en.books.field.description));
    await u.type(within(sheet).getByLabelText(en.books.field.description), 'my words');
    await u.click(within(sheet).getByTestId('search-online'));
    await u.click((await screen.findAllByTestId('result'))[0]!);
    const chip = within(sheet).getByTestId('suggestion-description');
    expect(chip).toHaveTextContent(`Use online value: ${'x'.repeat(47)}…`);
    expect(chip).toHaveAccessibleName(`Use online value for Description: ${'x'.repeat(120)}`);
  });

  it('shows the empty state and "Keep the data I typed" leaves the form untouched', async () => {
    api.searchResults = [DUNE];
    const u = user();
    const sheet = await openForm();
    await u.type(within(sheet).getByLabelText(en.books.field.title), 'Emma');
    await u.click(within(sheet).getByTestId('search-online'));
    const results = await screen.findByRole('dialog', { name: en.books.search.title });
    expect(await within(results).findByText(en.books.search.empty.title)).toBeInTheDocument();
    await u.click(within(results).getByTestId('keep-typed'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: en.books.search.title })).not.toBeInTheDocument(),
    );
    expect(within(sheet).getByLabelText(en.books.field.title)).toHaveValue('Emma');
    expect(within(sheet).queryByTestId('filled-from')).not.toBeInTheDocument();
  });

  it('shows the error state with a retry that searches again', async () => {
    api.searchResults = [DUNE];
    api.lookupDown = true;
    const u = user();
    const sheet = await openForm();
    await u.type(within(sheet).getByLabelText(en.books.field.title), 'Dune');
    await u.click(within(sheet).getByTestId('search-online'));
    const results = await screen.findByRole('dialog', { name: en.books.search.title });
    expect(await within(results).findByText(en.books.search.error.title)).toBeInTheDocument();

    api.lookupDown = false;
    await u.click(within(results).getByRole('button', { name: en.common.retry }));
    expect(await within(results).findByTestId('results')).toBeInTheDocument();
    expect(api.calls.filter((c) => c.path.startsWith('/api/lookup/search'))).toHaveLength(2);
  });

  it('drops an in-flight search when the sheet is dismissed or a field changes', async () => {
    api.searchResults = [DUNE];
    const u = user();
    const sheet = await openForm();
    await u.type(within(sheet).getByLabelText(en.books.field.title), 'Dune');

    // Hold every search reply until the test releases it, so the skeleton shows.
    let release: () => void = () => undefined;
    const mocked = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/lookup/search')) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return mocked(input, init);
    };
    const settle = () =>
      act(async () => {
        release();
        await new Promise((r) => setTimeout(r, 10));
      });
    const resultsSheet = () => screen.queryByRole('dialog', { name: en.books.search.title });

    try {
      await u.click(within(sheet).getByTestId('search-online'));
      const results = await screen.findByRole('dialog', { name: en.books.search.title });
      expect(within(results).getByTestId('results-loading')).toBeInTheDocument();
      expect(within(results).getByRole('status')).toHaveTextContent(en.books.search.searching);

      // "Keep the data I typed" cancels: when the reply lands, nothing reopens.
      await u.click(within(results).getByTestId('keep-typed'));
      await waitFor(() => expect(resultsSheet()).not.toBeInTheDocument());
      await settle();
      expect(resultsSheet()).not.toBeInTheDocument();
      expect(within(sheet).queryByTestId('filled-from')).not.toBeInTheDocument();

      // Escape closes the results sheet only (the form underneath stays), and
      // editing a field afterwards drops the search that was still running.
      await u.click(within(sheet).getByTestId('search-online'));
      await screen.findByTestId('results-loading');
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(resultsSheet()).not.toBeInTheDocument());
      expect(screen.getByRole('dialog', { name: en.books.add })).toBeInTheDocument();
      await u.type(within(sheet).getByLabelText(en.books.field.title), ' Messiah');
      await settle();
      expect(resultsSheet()).not.toBeInTheDocument();
      expect(within(sheet).getByLabelText(en.books.field.title)).toHaveValue('Dune Messiah');
    } finally {
      globalThis.fetch = mocked;
    }
  });

  it('is not offered when editing an existing book', async () => {
    const book = api.addBook({ title: 'Dune' });
    const u = user();
    await renderApp(`/books/${book.id}`);
    await u.click(await screen.findByRole('button', { name: en.common.edit }));
    const sheet = await screen.findByRole('dialog', { name: en.books.edit });
    expect(within(sheet).queryByTestId('search-online')).not.toBeInTheDocument();
    // Enter in the edit form never opens a search.
    await u.type(within(sheet).getByLabelText(en.books.field.title), ' II{Enter}');
    expect(screen.queryByRole('dialog', { name: en.books.search.title })).not.toBeInTheDocument();
    expect(api.calls.some((c) => c.path.startsWith('/api/lookup/search'))).toBe(false);
  });
});
