import { z } from 'zod';
import { isFutureDate, localDate } from '../dates';
import {
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  ownedSchema,
  timestampsSchema,
} from './common';

export const READ_STATUSES = ['to_read', 'reading', 'read'] as const;
export const readStatusSchema = z.enum(READ_STATUSES);
export type ReadStatus = z.infer<typeof readStatusSchema>;

/** The day a book was finished: any past day or today, never the future. */
export const readAtSchema = isoDateSchema.refine((date) => !isFutureDate(date), {
  message: 'Read date cannot be in the future',
});

/**
 * The read date a book carries after a status or date change. Only a finished
 * book has one: marking it read without a date stamps today (an existing date
 * survives), and going back to "to read" / "reading" clears it.
 */
export function resolveReadAt(
  readStatus: ReadStatus,
  readAt: string | null | undefined,
  current: string | null = null,
  today: string = localDate(),
): string | null {
  if (readStatus !== 'read') return null;
  return readAt ?? current ?? today;
}

/** Ratings are 1–5 stars; `0` (and `null`) mean "not rated" and are stored as `null`. */
export function normaliseRating(rating: number | null | undefined): number | null | undefined {
  if (rating === undefined) return undefined;
  return rating === null || rating === 0 ? null : rating;
}

const isbn10Schema = z
  .string()
  .regex(/^[0-9]{9}[0-9X]$/, 'Invalid ISBN-10')
  .nullable();
const isbn13Schema = z
  .string()
  .regex(/^97[89][0-9]{10}$/, 'Invalid ISBN-13')
  .nullable();

export const bookSchema = z
  .object({
    id: idSchema,
    shelfId: idSchema,
    isbn10: isbn10Schema,
    isbn13: isbn13Schema,
    title: z.string().trim().min(1).max(500),
    subtitle: z.string().trim().max(500).nullable(),
    authors: z.array(z.string().trim().min(1).max(200)),
    publisher: z.string().trim().max(200).nullable(),
    /** Free-form publication date as reported by metadata providers ("1999", "2004-03"). */
    publishedDate: z.string().trim().max(40).nullable(),
    pages: z.number().int().positive().nullable(),
    /** BCP-47 / ISO 639 language tag ("en", "es", "pt-BR"). */
    language: z.string().trim().max(16).nullable(),
    coverUrl: z.url().max(2048).nullable(),
    categories: z.array(z.string().trim().min(1).max(120)),
    description: z.string().max(10_000).nullable(),
    notes: z.string().max(10_000).nullable(),
    /** 1–5 stars; `0` on input means "clear", stored and returned as `null`. */
    rating: z.number().int().min(0).max(5).nullable(),
    readStatus: readStatusSchema,
    readAt: readAtSchema.nullable(),
    addedAt: isoDateTimeSchema,
  })
  .extend(ownedSchema.shape)
  .extend(timestampsSchema.shape);

export type Book = z.infer<typeof bookSchema>;

export const createBookInputSchema = bookSchema
  .omit({ id: true, ownerId: true, addedAt: true, createdAt: true, updatedAt: true })
  .partial()
  .required({ title: true });

export type CreateBookInput = z.infer<typeof createBookInputSchema>;

export const updateBookInputSchema = createBookInputSchema.partial();

export type UpdateBookInput = z.infer<typeof updateBookInputSchema>;
