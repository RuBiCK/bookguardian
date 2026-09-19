import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv, Services } from './app-env';
import { notFound, onError } from './errors';
import { healthRoutes } from './routes/health';

export interface CreateAppOptions {
  services: Services;
  /** Disable request logging (tests). */
  quiet?: boolean;
}

export function createApp({ services, quiet = false }: CreateAppOptions) {
  const app = new Hono<AppEnv>();

  if (!quiet) app.use(logger());
  app.use(secureHeaders());
  app.use('/api/*', cors());
  app.use(async (c, next) => {
    c.set('services', services);
    await next();
  });

  const api = new Hono<AppEnv>().route('/health', healthRoutes);

  app.route('/api', api);
  app.notFound(notFound);
  app.onError(onError);

  return app;
}

export type App = ReturnType<typeof createApp>;
