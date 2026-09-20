import { z } from 'zod';
import { localDate } from '../dates';
import {
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  ownedSchema,
  timestampsSchema,
} from './common';

export const lendingSchema = z
  .object({
    id: idSchema,
    bookId: idSchema,
    borrowerName: z.string().trim().min(1).max(200),
    /** Free-form: a phone number, an email, "colleague from work"… */
    borrowerContact: z.string().trim().max(300).nullable(),
    lentAt: isoDateTimeSchema,
    dueAt: isoDateSchema.nullable(),
    returnedAt: isoDateTimeSchema.nullable(),
  })
  .extend(ownedSchema.shape)
  .extend(timestampsSchema.shape);

export type Lending = z.infer<typeof lendingSchema>;

export const createLendingInputSchema = lendingSchema
  .pick({ bookId: true, borrowerName: true, borrowerContact: true, lentAt: true, dueAt: true })
  .partial({ borrowerContact: true, lentAt: true, dueAt: true });

export type CreateLendingInput = z.infer<typeof createLendingInputSchema>;

export const returnLendingInputSchema = z.object({
  returnedAt: isoDateTimeSchema.optional(),
});

export type ReturnLendingInput = z.infer<typeof returnLendingInputSchema>;

/** A lending is active until the book comes back. */
export function isActiveLending(lending: Pick<Lending, 'returnedAt'>): boolean {
  return lending.returnedAt === null;
}

/**
 * Overdue = still out with a due date that is already behind us. `today` is
 * a `YYYY-MM-DD` day so the due day itself is not yet overdue (ISO dates
 * compare lexically).
 */
export function isOverdue(
  lending: Pick<Lending, 'dueAt' | 'returnedAt'>,
  today: string = localDate(),
): boolean {
  return isActiveLending(lending) && lending.dueAt !== null && lending.dueAt < today;
}

const DAY_MS = 86_400_000;

/**
 * Whole days a book has been out (since `lentAt`, until `returnedAt` or
 * `now`); never negative. A book lent this morning is out for 0 days.
 */
export function daysOut(
  lending: Pick<Lending, 'lentAt' | 'returnedAt'>,
  now: Date = new Date(),
): number {
  const end = lending.returnedAt ? new Date(lending.returnedAt) : now;
  const elapsed = end.getTime() - new Date(lending.lentAt).getTime();
  return Math.max(0, Math.floor(elapsed / DAY_MS));
}
