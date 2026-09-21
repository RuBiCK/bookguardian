import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { computeStats } from '../stats';

export const statsRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const stats = await computeStats(c.get('services').repos, c.get('ownerId'));
  return c.json(stats);
});
