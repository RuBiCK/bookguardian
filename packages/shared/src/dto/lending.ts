import { z } from 'zod';
import { bookSchema } from '../schemas/book';
import { idSchema } from '../schemas/common';
import { lendingSchema } from '../schemas/lending';

/** The bit of the book a lending row needs to show: cover, title, authors. */
export const lentBookSchema = bookSchema.pick({
  id: true,
  title: true,
  authors: true,
  coverAssetId: true,
  coverUrl: true,
  shelfId: true,
});
export type LentBook = z.infer<typeof lentBookSchema>;

/**
 * A lending as listed in the Lending tab and on the book page. `overdue` is
 * computed by the API from its calendar day (`isOverdue`), so filters and
 * badges agree with what the server would say.
 */
export const lendingWithBookSchema = lendingSchema.extend({
  book: lentBookSchema,
  overdue: z.boolean(),
});
export type LendingWithBook = z.infer<typeof lendingWithBookSchema>;

const boolQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

/**
 * `GET /api/lendings`: active lendings by default (newest first); `active=false`
 * lists returned ones too; `overdue=true` keeps only the overdue ones.
 */
export const lendingListQuerySchema = z.object({
  active: boolQuery,
  overdue: boolQuery,
  bookId: idSchema.optional(),
});
export type LendingListQuery = z.infer<typeof lendingListQuerySchema>;

export const lendingListResponseSchema = z.object({ items: z.array(lendingWithBookSchema) });
export type LendingListResponse = z.infer<typeof lendingListResponseSchema>;

/** Someone the user has lent a book to before, for the borrower autocomplete. */
export const borrowerSchema = z.object({
  name: z.string(),
  contact: z.string().nullable(),
  /** When this borrower last took a book (ISO timestamp), most recent first in lists. */
  lastLentAt: z.string(),
});
export type Borrower = z.infer<typeof borrowerSchema>;

export const borrowerListResponseSchema = z.object({ items: z.array(borrowerSchema) });
export type BorrowerListResponse = z.infer<typeof borrowerListResponseSchema>;
