import { z } from 'zod';
import { bookSchema, createBookInputSchema, readStatusSchema } from '../schemas/book';
import { idSchema } from '../schemas/common';
import { librarySchema } from '../schemas/library';
import { shelfSchema } from '../schemas/shelf';
import { paginationQuerySchema } from './common';

/** A library as listed in the Library tab: shelves and books counted in. */
export const libraryWithCountsSchema = librarySchema.extend({
  shelfCount: z.number().int().nonnegative(),
  bookCount: z.number().int().nonnegative(),
});
export type LibraryWithCounts = z.infer<typeof libraryWithCountsSchema>;

export const libraryListResponseSchema = z.object({ items: z.array(libraryWithCountsSchema) });
export type LibraryListResponse = z.infer<typeof libraryListResponseSchema>;

/** A shelf with the number of books it holds. */
export const shelfWithCountSchema = shelfSchema.extend({
  bookCount: z.number().int().nonnegative(),
});
export type ShelfWithCount = z.infer<typeof shelfWithCountSchema>;

export const shelfListQuerySchema = z.object({ libraryId: idSchema.optional() });
export type ShelfListQuery = z.infer<typeof shelfListQuerySchema>;

export const shelfListResponseSchema = z.object({ items: z.array(shelfWithCountSchema) });
export type ShelfListResponse = z.infer<typeof shelfListResponseSchema>;

/** Persist a new shelf order: `shelfIds` must be every shelf of `libraryId`, in the desired order. */
export const reorderShelvesInputSchema = z.object({
  libraryId: idSchema,
  shelfIds: z.array(idSchema).min(1),
});
export type ReorderShelvesInput = z.infer<typeof reorderShelvesInputSchema>;

/**
 * Deleting a shelf or library that still holds books requires a destination
 * shelf for them; without one the API answers 409 and nothing changes.
 */
export const deleteContainerQuerySchema = z.object({ moveBooksTo: idSchema.optional() });
export type DeleteContainerQuery = z.infer<typeof deleteContainerQuerySchema>;

/** `added`/`read` are newest first (unread books last for `read`); `rating` is best first, unrated last. */
export const BOOK_SORTS = ['added', 'title', 'read', 'rating'] as const;
export const bookSortSchema = z.enum(BOOK_SORTS);
export type BookSort = z.infer<typeof bookSortSchema>;

export const bookListQuerySchema = paginationQuerySchema.extend({
  /** Case-insensitive substring match on title, subtitle, authors, publisher and ISBNs. */
  q: z.string().trim().max(200).optional(),
  libraryId: idSchema.optional(),
  shelfId: idSchema.optional(),
  readStatus: readStatusSchema.optional(),
  /** Only books rated at least this many stars (1–5). */
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  sort: bookSortSchema.default('added'),
});
export type BookListQuery = z.infer<typeof bookListQuerySchema>;

export const bookPageSchema = z.object({
  items: z.array(bookSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type BookPage = z.infer<typeof bookPageSchema>;

/** `shelfId` is optional on the wire: the API falls back to the user's default shelf. */
export const createBookRequestSchema = createBookInputSchema;
export type CreateBookRequest = z.infer<typeof createBookRequestSchema>;

export const moveBookInputSchema = z.object({ shelfId: idSchema });
export type MoveBookInput = z.infer<typeof moveBookInputSchema>;

/** Where a new book lands when the user does not pick a place: the most recently used shelf. */
export const inventoryDefaultsSchema = z.object({
  libraryId: idSchema,
  shelfId: idSchema,
});
export type InventoryDefaults = z.infer<typeof inventoryDefaultsSchema>;
