import { z } from 'zod';
import { isFutureDate, localDate } from '../dates';
import { hasBlockedHost } from '../lib/ip';
import {
  httpUrlSchema,
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

/** Content hash (SHA-256, hex) that names a stored cover file. */
export const coverAssetIdSchema = z.string().regex(/^[a-f0-9]{64}$/, 'Invalid cover asset id');

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
    /**
     * Cover asset the book shows: the shared cover of its ISBN, or the
     * user's own (`coverOverride`). `null` while unresolved / not found.
     */
    coverAssetId: coverAssetIdSchema.nullable(),
    /** `true` once the user replaced the catalogue cover with a photo or a URL of their own. */
    coverOverride: z.boolean(),
    /** Where to load the cover from (`/api/covers/<id>.webp`); computed by the API, never stored. */
    coverUrl: z.string().min(1).max(2048).nullable(),
    /** The cover cascade is still running for this book; poll until it settles. */
    coverPending: z.boolean(),
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

/**
 * A cover URL a client may paste. The server fetches it, so the scheme is
 * `http`/`https` only and a literal address inside the deployment's own
 * network is refused outright (BOOK-20). A *hostname* still passes here —
 * what it resolves to is re-checked, after DNS and after every redirect, by
 * the API's download guard.
 */
export const coverUrlInputSchema = httpUrlSchema
  .max(2048)
  .refine((value) => !hasBlockedHost(value), { message: 'Cover URL host is not allowed' });

/**
 * What a client may send. `coverUrl` here is an instruction, not the stored
 * value: the API downloads that image and makes it the book's own cover
 * (`coverOverride`); `null` on an update drops a user cover and falls back to
 * the catalogue one. Leave it out to keep whatever the book has.
 */
export const createBookInputSchema = bookSchema
  .omit({
    id: true,
    ownerId: true,
    addedAt: true,
    createdAt: true,
    updatedAt: true,
    coverAssetId: true,
    coverOverride: true,
    coverUrl: true,
    coverPending: true,
  })
  .extend({ coverUrl: coverUrlInputSchema.nullable() })
  .partial()
  .required({ title: true });

export type CreateBookInput = z.infer<typeof createBookInputSchema>;

export const updateBookInputSchema = createBookInputSchema.partial();

export type UpdateBookInput = z.infer<typeof updateBookInputSchema>;
