import {
  createBookInputSchema,
  yearOf,
  type Book,
  type BookDraft,
  type CreateBookInput,
  type LookupSearchInput,
} from '@bookguardian/shared';
import { emptyToNull, joinList, parseIsbn, splitList } from './format';

/** What the add/edit sheet edits: plain strings so every field is a simple input. */
export interface BookFormValues {
  title: string;
  authors: string;
  isbn: string;
  subtitle: string;
  publisher: string;
  year: string;
  pages: string;
  language: string;
  categories: string;
  coverUrl: string;
  description: string;
  notes: string;
}

export type BookFormField = keyof BookFormValues;
export type BookFormErrors = Partial<Record<BookFormField, 'required' | 'invalid'>>;

export const EMPTY_BOOK_FORM: BookFormValues = {
  title: '',
  authors: '',
  isbn: '',
  subtitle: '',
  publisher: '',
  year: '',
  pages: '',
  language: '',
  categories: '',
  coverUrl: '',
  description: '',
  notes: '',
};

export function bookToForm(book: Book): BookFormValues {
  return {
    title: book.title,
    authors: joinList(book.authors),
    isbn: book.isbn13 ?? book.isbn10 ?? '',
    subtitle: book.subtitle ?? '',
    publisher: book.publisher ?? '',
    year: book.publishedDate ?? '',
    pages: book.pages?.toString() ?? '',
    language: book.language ?? '',
    categories: joinList(book.categories),
    // The served cover is not editable text; a URL typed here replaces it.
    coverUrl: '',
    description: book.description ?? '',
    notes: book.notes ?? '',
  };
}

/**
 * Pre-fill the add form from a catalogue result (ISBN scan / cover search),
 * or from whatever partial facts a failed scan left behind (just the ISBN,
 * an OCR title guess).
 */
export function draftToForm(draft: Partial<BookDraft>): BookFormValues {
  return {
    title: draft.title ?? '',
    authors: joinList(draft.authors ?? []),
    isbn: draft.isbn13 ?? draft.isbn10 ?? '',
    subtitle: draft.subtitle ?? '',
    publisher: draft.publisher ?? '',
    year: draft.publishedDate ?? '',
    pages: draft.pages?.toString() ?? '',
    language: draft.language ?? '',
    categories: joinList(draft.categories ?? []),
    // The API fetches its own copy of the provider cover by ISBN.
    coverUrl: '',
    description: draft.description ?? '',
    notes: '',
  };
}

/** The API payload for a one-tap "Add" straight from a catalogue result. */
export function draftToInput(draft: BookDraft): CreateBookInput {
  return {
    title: draft.title,
    subtitle: draft.subtitle,
    authors: draft.authors,
    isbn10: draft.isbn10,
    isbn13: draft.isbn13,
    publisher: draft.publisher,
    publishedDate: draft.publishedDate,
    pages: draft.pages,
    language: draft.language,
    categories: draft.categories,
    description: draft.description,
  };
}

export type BookFormResult =
  { ok: true; input: CreateBookInput } | { ok: false; errors: BookFormErrors };

/**
 * Validate the form and produce the API payload (all fields, so edits clear
 * values too — except `coverUrl`, which is only sent when typed: it asks the
 * API to fetch that image as the book's own cover).
 */
export function formToInput(values: BookFormValues): BookFormResult {
  const errors: BookFormErrors = {};
  const title = values.title.trim();
  if (!title) errors.title = 'required';

  const isbn = parseIsbn(values.isbn);
  if (isbn === 'invalid') errors.isbn = 'invalid';

  const pagesRaw = values.pages.trim();
  const pages = pagesRaw === '' ? null : Number(pagesRaw);
  if (pages !== null && (!Number.isInteger(pages) || pages <= 0)) errors.pages = 'invalid';

  const coverUrl = emptyToNull(values.coverUrl);
  if (coverUrl && !/^https?:\/\/\S+$/i.test(coverUrl)) errors.coverUrl = 'invalid';

  const candidate: CreateBookInput = {
    title,
    authors: splitList(values.authors),
    isbn10: isbn && isbn !== 'invalid' ? isbn.isbn10 : null,
    isbn13: isbn && isbn !== 'invalid' ? isbn.isbn13 : null,
    subtitle: emptyToNull(values.subtitle),
    publisher: emptyToNull(values.publisher),
    publishedDate: emptyToNull(values.year),
    pages: errors.pages ? null : pages,
    language: emptyToNull(values.language),
    categories: splitList(values.categories),
    description: emptyToNull(values.description),
    notes: emptyToNull(values.notes),
  };
  if (coverUrl && !errors.coverUrl) candidate.coverUrl = coverUrl;

  const parsed = createBookInputSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'title') errors.title ??= 'invalid';
      else if (field === 'isbn10' || field === 'isbn13') errors.isbn ??= 'invalid';
      else if (field === 'coverUrl') errors.coverUrl ??= 'invalid';
      else if (field === 'pages') errors.pages ??= 'invalid';
      else if (field === 'publishedDate') errors.year ??= 'invalid';
      else if (typeof field === 'string' && field in EMPTY_BOOK_FORM) {
        errors[field as BookFormField] ??= 'invalid';
      }
    }
  }

  if (Object.keys(errors).length > 0 || !parsed.success) return { ok: false, errors };
  return { ok: true, input: parsed.data };
}

/** Fields "Search online" can query; typing in any of them enables the search. */
export const SEARCHABLE_FIELDS = ['title', 'authors', 'isbn', 'publisher', 'year'] as const;
export type SearchableField = (typeof SEARCHABLE_FIELDS)[number];

/**
 * The lookup query for a half-filled form: every searchable field with text,
 * the year reduced to four digits, an ISBN only when it is a real one (a
 * mistyped ISBN would sink the whole search; Save reports it instead).
 * Empty when there is nothing to search for.
 */
export function searchFieldsOf(values: BookFormValues): LookupSearchInput {
  const fields: LookupSearchInput = {};
  if (values.title.trim()) fields.title = values.title.trim();
  if (values.authors.trim()) fields.author = values.authors.trim();
  const isbn = parseIsbn(values.isbn);
  if (isbn && isbn !== 'invalid') fields.isbn = isbn.isbn13;
  if (values.publisher.trim()) fields.publisher = values.publisher.trim();
  const year = yearOf(values.year);
  if (year) fields.year = String(year);
  return fields;
}

/** What the user typed and an online result disagree on: field → the online value, one tap to take it. */
export type OnlineSuggestions = Partial<Record<BookFormField, string>>;

const MERGEABLE_FIELDS = [
  'title',
  'authors',
  'subtitle',
  'publisher',
  'year',
  'pages',
  'language',
  'categories',
  'description',
] as const;

const sameText = (a: string, b: string) =>
  a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Fill the form from a picked online result without losing what the user
 * typed: empty fields take the result's value, filled ones are kept and the
 * differing online value comes back as a suggestion chip. The ISBN is a key,
 * not an opinion, so the result's always wins. The cover goes through the
 * API's own pipeline — by ISBN when there is one, else from the provider URL.
 */
export function mergeDraftIntoForm(
  values: BookFormValues,
  draft: BookDraft,
): { values: BookFormValues; suggestions: OnlineSuggestions } {
  const online = draftToForm(draft);
  const next = { ...values };
  const suggestions: OnlineSuggestions = {};
  for (const field of MERGEABLE_FIELDS) {
    const theirs = online[field];
    if (!theirs) continue;
    if (!values[field].trim()) next[field] = theirs;
    else if (!sameText(values[field], theirs)) suggestions[field] = theirs;
  }
  if (online.isbn) next.isbn = online.isbn;
  if (!draft.isbn13 && draft.coverUrl && !values.coverUrl.trim()) next.coverUrl = draft.coverUrl;
  return { values: next, suggestions };
}
