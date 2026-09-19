import { z } from 'zod';
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
