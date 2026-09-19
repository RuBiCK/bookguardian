import { z } from 'zod';
import { idSchema, ownedSchema, timestampsSchema } from './common';

export const librarySchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(120),
    location: z.string().trim().max(200).nullable(),
  })
  .extend(ownedSchema.shape)
  .extend(timestampsSchema.shape);

export type Library = z.infer<typeof librarySchema>;

export const createLibraryInputSchema = librarySchema
  .pick({ name: true, location: true })
  .partial({ location: true });

export type CreateLibraryInput = z.infer<typeof createLibraryInputSchema>;

export const updateLibraryInputSchema = createLibraryInputSchema.partial();

export type UpdateLibraryInput = z.infer<typeof updateLibraryInputSchema>;
