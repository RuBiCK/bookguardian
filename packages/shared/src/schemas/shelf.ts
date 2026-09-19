import { z } from 'zod';
import { idSchema, ownedSchema, timestampsSchema } from './common';

export const shelfSchema = z
  .object({
    id: idSchema,
    libraryId: idSchema,
    name: z.string().trim().min(1).max(120),
    sortOrder: z.number().int().min(0),
  })
  .extend(ownedSchema.shape)
  .extend(timestampsSchema.shape);

export type Shelf = z.infer<typeof shelfSchema>;

export const createShelfInputSchema = shelfSchema
  .pick({ libraryId: true, name: true, sortOrder: true })
  .partial({ sortOrder: true });

export type CreateShelfInput = z.infer<typeof createShelfInputSchema>;

export const updateShelfInputSchema = createShelfInputSchema.omit({ libraryId: true }).partial();

export type UpdateShelfInput = z.infer<typeof updateShelfInputSchema>;
