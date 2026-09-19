import { createBookInputSchema, type Book, type CreateBookInput } from '@bookguardian/shared';
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
    coverUrl: book.coverUrl ?? '',
    description: book.description ?? '',
    notes: book.notes ?? '',
  };
}

export type BookFormResult =
  { ok: true; input: CreateBookInput } | { ok: false; errors: BookFormErrors };

/** Validate the form and produce the API payload (all fields, so edits clear values too). */
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
    coverUrl: errors.coverUrl ? null : coverUrl,
    description: emptyToNull(values.description),
    notes: emptyToNull(values.notes),
  };

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
