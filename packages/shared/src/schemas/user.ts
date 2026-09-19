import { z } from 'zod';
import { idSchema, timestampsSchema } from './common';

export const userSchema = z
  .object({
    id: idSchema,
    displayName: z.string().trim().min(1).max(120),
    email: z.email().max(254).nullable(),
  })
  .extend(timestampsSchema.shape);

export type User = z.infer<typeof userSchema>;
