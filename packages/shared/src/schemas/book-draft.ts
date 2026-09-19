import { z } from 'zod';
import { bookSchema } from './book';

export const BOOK_SOURCES = ['open_library', 'google_books'] as const;
export const bookSourceSchema = z.enum(BOOK_SOURCES);
export type BookSource = z.infer<typeof bookSourceSchema>;

/**
 * A book as returned by a metadata provider, normalised to the fields the
 * add-book form can be pre-filled with. Never stored as-is: the user reviews
 * it and it becomes a `CreateBookInput`.
 */
export const bookDraftSchema = bookSchema
  .pick({
    isbn10: true,
    isbn13: true,
    title: true,
    subtitle: true,
    authors: true,
    publisher: true,
    publishedDate: true,
    pages: true,
    language: true,
    coverUrl: true,
    categories: true,
    description: true,
  })
  .extend({
    source: bookSourceSchema,
    /** Provider-specific identifier (Open Library key, Google volume id) for debugging. */
    sourceId: z.string().max(200).nullable(),
  });

export type BookDraft = z.infer<typeof bookDraftSchema>;
