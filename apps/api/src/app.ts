import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv, Services } from './app-env';
import { notFound, onError } from './errors';
import { ownerMiddleware, type OwnerResolver } from './owner';
import { bookRoutes, defaultsRoutes } from './routes/books';
import { coverRoutes } from './routes/covers';
import { healthRoutes } from './routes/health';
import { lendingRoutes } from './routes/lendings';
import { libraryRoutes } from './routes/libraries';
import { lookupRoutes } from './routes/lookup';
import { shelfRoutes } from './routes/shelves';
import { mountWebApp } from './web-app';

export interface CreateAppOptions {
  services: Services;
  /** Disable request logging (tests). */
  quiet?: boolean;
  /** Absolute path of the built SPA to serve next to the API (see `web-app.ts`). */
  webDist?: string;
  /** Test seam: act as another user (see `owner.ts`). */
  resolveOwner?: OwnerResolver;
}

export function createApp({ services, quiet = false, webDist, resolveOwner }: CreateAppOptions) {
  const app = new Hono<AppEnv>();

  if (!quiet) app.use(logger());
  // Cover images are loaded by <img> from wherever the SPA lives (a
  // different origin in dev / VITE_API_URL setups), which the default
  // `same-origin` Cross-Origin-Resource-Policy would block.
  const secure = secureHeaders();
  const secureCovers = secureHeaders({ crossOriginResourcePolicy: 'cross-origin' });
  app.use((c, next) =>
    c.req.path.startsWith('/api/covers/') ? secureCovers(c, next) : secure(c, next),
  );
  app.use('/api/*', cors());
  app.use(async (c, next) => {
    c.set('services', services);
    await next();
  });

  const api = new Hono<AppEnv>()
    .route('/health', healthRoutes)
    .use(ownerMiddleware(resolveOwner))
    .route('/libraries', libraryRoutes)
    .route('/shelves', shelfRoutes)
    .route('/books', bookRoutes)
    .route('/defaults', defaultsRoutes)
    .route('/lendings', lendingRoutes)
    .route('/lookup', lookupRoutes)
    .route('/covers', coverRoutes);

  app.route('/api', api);
  if (webDist) mountWebApp(app, webDist);
  app.notFound(notFound);
  app.onError(onError);

  return app;
}

export type App = ReturnType<typeof createApp>;
