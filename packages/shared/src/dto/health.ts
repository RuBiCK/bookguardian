import { z } from 'zod';

export const DB_DRIVERS = ['sqlite', 'postgres', 'mysql'] as const;
export const dbDriverSchema = z.enum(DB_DRIVERS);
export type DbDriver = z.infer<typeof dbDriverSchema>;

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  database: z.object({
    driver: dbDriverSchema,
    reachable: z.boolean(),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
