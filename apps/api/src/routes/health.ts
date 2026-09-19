import { Hono } from 'hono';
import { z } from 'zod';
import type { HealthResponse } from '@bookguardian/shared';
import type { AppEnv } from '../app-env';
import { validate } from '../validation';

const startedAt = Date.now();

const healthQuerySchema = z.object({
  /** Skip the database round-trip (used by liveness probes). */
  shallow: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export const healthRoutes = new Hono<AppEnv>().get(
  '/',
  validate('query', healthQuerySchema),
  async (c) => {
    const { shallow } = c.req.valid('query');
    const { adapter, version } = c.get('services');
    const reachable = shallow ? true : await adapter.ping();

    const body: HealthResponse = {
      status: reachable ? 'ok' : 'degraded',
      version,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      database: { driver: adapter.driver, reachable },
    };
    return c.json(body, reachable ? 200 : 503);
  },
);
