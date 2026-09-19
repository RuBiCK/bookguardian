import { z } from 'zod';
import { idSchema, timestampsSchema } from './common';

/** Roles a grantee can hold on a shared library. Only read-only sharing exists for now. */
export const SHARE_ROLES = ['viewer'] as const;
export const shareRoleSchema = z.enum(SHARE_ROLES);
export type ShareRole = z.infer<typeof shareRoleSchema>;

export const libraryShareSchema = z
  .object({
    id: idSchema,
    libraryId: idSchema,
    granteeId: idSchema,
    role: shareRoleSchema,
  })
  .extend(timestampsSchema.shape);

export type LibraryShare = z.infer<typeof libraryShareSchema>;

export const createLibraryShareInputSchema = libraryShareSchema
  .pick({ libraryId: true, granteeId: true, role: true })
  .partial({ role: true });

export type CreateLibraryShareInput = z.infer<typeof createLibraryShareInputSchema>;
