import { zValidator as baseValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodType } from 'zod';

/**
 * `zValidator` preconfigured to reply with the shared error envelope instead
 * of Hono's default 400 text response. Use it on every route that reads
 * params, query or body.
 */
export const validate = <T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  baseValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'validation_error',
            message: `Invalid ${target}`,
            details: result.error.issues,
          },
        },
        422,
      );
    }
    return undefined;
  });
