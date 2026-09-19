import { describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  DB_DRIVERS,
  dbDriverSchema,
  healthResponseSchema,
  idParamSchema,
  paginationQuerySchema,
} from '../src';

describe('API DTOs', () => {
  it('paginationQuery coerces strings and applies defaults and bounds', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ limit: 50, offset: 0 });
    expect(paginationQuerySchema.parse({ limit: '10', offset: '20' })).toEqual({
      limit: 10,
      offset: 20,
    });
    expect(paginationQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ limit: '201' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ offset: '-1' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ limit: '1.5' }).success).toBe(false);
  });

  it('idParam requires a UUID', () => {
    expect(idParamSchema.safeParse({ id: '0f3e2b8a-7d3c-4b2f-9a11-6f5e4d3c2b1a' }).success).toBe(
      true,
    );
    expect(idParamSchema.safeParse({ id: '123' }).success).toBe(false);
  });

  it('apiError requires code and message, details optional', () => {
    expect(apiErrorSchema.safeParse({ error: { code: 'x', message: 'y' } }).success).toBe(true);
    expect(
      apiErrorSchema.safeParse({ error: { code: 'x', message: 'y', details: [1] } }).success,
    ).toBe(true);
    expect(apiErrorSchema.safeParse({ error: { code: 'x' } }).success).toBe(false);
    expect(apiErrorSchema.safeParse({ message: 'y' }).success).toBe(false);
  });

  it('health response enumerates drivers and statuses', () => {
    expect(DB_DRIVERS).toEqual(['sqlite', 'postgres', 'mysql']);
    expect(dbDriverSchema.safeParse('oracle').success).toBe(false);
    const base = {
      status: 'degraded',
      version: '1.0.0',
      uptimeSeconds: 0,
      database: { driver: 'mysql', reachable: false },
    };
    expect(healthResponseSchema.safeParse(base).success).toBe(true);
    expect(healthResponseSchema.safeParse({ ...base, status: 'down' }).success).toBe(false);
    expect(healthResponseSchema.safeParse({ ...base, uptimeSeconds: -1 }).success).toBe(false);
  });
});
