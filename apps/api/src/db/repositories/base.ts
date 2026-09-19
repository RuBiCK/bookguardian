import { randomUUID } from 'node:crypto';
import { and, type SQL } from 'drizzle-orm';

export const newId = (): string => randomUUID();
export const nowIso = (): string => new Date().toISOString();

/**
 * `and()` from drizzle returns `SQL | undefined` (undefined when called with no
 * conditions). Repositories always pass at least one, so narrow the type and
 * keep `update`/`delete` from ever receiving an empty WHERE.
 */
export function allOf(first: SQL, ...rest: SQL[]): SQL {
  return and(first, ...rest)!;
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = 'NotFoundError';
  }
}
