import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv, Services } from './app-env';
import {
  authMiddleware,
  createAuthRoutes,
  createSessionService,
  type OidcClient,
  type OwnerResolver,
  type ResolveAccountOptions,
  type SessionService,
} from './auth';
import { notFound, onError } from './errors';
import { bookRoutes, defaultsRoutes } from './routes/books';
import { coverRoutes } from './routes/covers';
import { healthRoutes } from './routes/health';
import { lendingRoutes } from './routes/lendings';
import { libraryRoutes } from './routes/libraries';
import { lookupRoutes } from './routes/lookup';
import { shelfRoutes } from './routes/shelves';
import { statsRoutes } from './routes/stats';
import { mountWebApp } from './web-app';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AuthAppOptions {
  /** `test` registers `POST /api/auth/test-login`; nothing else depends on it. */
  env?: 'development' | 'test' | 'production';
  /** Public origin (`AUTH_BASE_URL`); https ⇒ cookies carry `Secure`. */
  baseUrl?: string;
  /** Signs the in-flight OAuth cookie; random per process when omitted. */
  cookieSecret?: string;
  /** Share the session service with the process (daily purge); built here when omitted. */
  sessions?: SessionService;
  sessionTtlMs?: number;
  /** Google client, or `undefined` to answer 503 `auth_not_configured`. */
  oidc?: OidcClient;
  account?: ResolveAccountOptions;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface CreateAppOptions {
  services: Services;
  /** Disable request logging (tests). */
  quiet?: boolean;
  /** Absolute path of the built SPA to serve next to the API (see `web-app.ts`). */
  webDist?: string;
  auth?: AuthAppOptions;
  /** Test seam: act as another user without a session (see `auth/middleware.ts`). */
  resolveOwner?: OwnerResolver;
}

export function createApp({
  services,
  quiet = false,
  webDist,
  auth = {},
  resolveOwner,
}: CreateAppOptions) {
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

  const sessions =
    auth.sessions ??
    createSessionService({
      repos: services.repos,
      ttlMs: auth.sessionTtlMs ?? 30 * DAY_MS,
      now: auth.now,
    });
  const secureCookies = (auth.baseUrl ?? '').startsWith('https://');
  const authRoutes = createAuthRoutes({
    env: auth.env ?? 'development',
    sessions,
    cookieSecret: auth.cookieSecret ?? randomBytes(32).toString('base64url'),
    secureCookies,
    oidc: auth.oidc,
    account: auth.account ?? {},
    log: auth.log,
  });

  const api = new Hono<AppEnv>()
    .route('/health', healthRoutes)
    .route('/auth', authRoutes)
    .use(authMiddleware({ sessions, secureCookies, resolveOwner }))
    .route('/libraries', libraryRoutes)
    .route('/shelves', shelfRoutes)
    .route('/books', bookRoutes)
    .route('/defaults', defaultsRoutes)
    .route('/lendings', lendingRoutes)
    .route('/stats', statsRoutes)
    .route('/lookup', lookupRoutes)
    .route('/covers', coverRoutes);

  app.route('/api', api);
  if (webDist) mountWebApp(app, webDist);
  app.notFound(notFound);
  app.onError(onError);

  return app;
}

export type App = ReturnType<typeof createApp>;
