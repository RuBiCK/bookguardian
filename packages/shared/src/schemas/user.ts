import { z } from 'zod';
import { idSchema, isoDateTimeSchema, timestampsSchema } from './common';

export const userSchema = z
  .object({
    id: idSchema,
    displayName: z.string().trim().min(1).max(120),
    /**
     * Lower-cased, unique. Null only for the legacy local user of a database
     * seeded before accounts existed, until the first sign-in claims it.
     */
    email: z.email().max(254).nullable(),
    emailVerified: z.boolean(),
    avatarUrl: z.url().max(2048).nullable(),
    lastLoginAt: isoDateTimeSchema.nullable(),
  })
  .extend(timestampsSchema.shape);

export type User = z.infer<typeof userSchema>;
