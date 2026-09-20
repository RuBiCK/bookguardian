import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createGoogleOidcClient, createSessionService } from './auth';
import { loadConfig } from './config';
import { createDefaultCoverService } from './covers';
import { createAdapter } from './db/adapters';
import { migrate } from './db/migrate';
import { createRepositories } from './db/repositories';
import { createDefaultLookupService } from './lookup';
import { version } from './version';

const config = loadConfig();
const adapter = createAdapter(config.db);

// Apply pending migrations at boot so `pnpm dev` on a fresh clone just works.
// Users arrive through sign-in (see `auth/account.ts`); `pnpm db:seed
// --local-user` is the development-only way to get one without Google.
const migrated = await migrate(adapter);
if (migrated.applied.length > 0) {
  console.log(`[api] applied ${migrated.applied.length} migration(s)`);
}

const repos = createRepositories(adapter);
const lookup = createDefaultLookupService(config.lookup, repos.catalogBooks);
const sessions = createSessionService({ repos, ttlMs: config.auth.sessionTtlMs });
const covers = createDefaultCoverService(config.covers, repos, {
  // Expired sessions ride on the same daily housekeeping timer as the cover GC.
  gcHooks: [
    async () => {
      const purged = await sessions.purgeExpired();
      if (purged > 0) console.log(`[auth] purged ${purged} expired session(s)`);
    },
  ],
});

// Google sign-in is optional at boot (a fresh container has no secrets yet),
// but without it nobody can get past `/api/auth/google`.
const { auth } = config;
const oidc =
  auth.googleClientId && auth.googleClientSecret
    ? createGoogleOidcClient({
        clientId: auth.googleClientId,
        clientSecret: auth.googleClientSecret,
        redirectUri: auth.redirectUri,
      })
    : undefined;
if (!oidc) {
  console.warn(
    '[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set: Google sign-in is disabled (503 auth_not_configured)',
  );
} else {
  console.log(`[auth] Google sign-in enabled, redirect URI ${auth.redirectUri}`);
}
if (auth.cookieSecretGenerated && config.env === 'production') {
  console.warn(
    '[auth] AUTH_COOKIE_SECRET is not set: sign-ins in flight will not survive a restart',
  );
}
if (auth.allowedEmails) {
  console.log(`[auth] account creation limited to ${auth.allowedEmails.size} allowed email(s)`);
}

const app = createApp({
  services: { adapter, repos, lookup, covers, version },
  webDist: config.webDist,
  auth: {
    env: config.env,
    baseUrl: auth.baseUrl,
    cookieSecret: auth.cookieSecret,
    sessions,
    oidc,
    account: { allowedEmails: auth.allowedEmails },
  },
});
// Sweep unreferenced cover files and queue covers for books that still lack
// one (existing libraries get theirs without anyone pressing a button).
await covers.start();

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port} (db: ${adapter.driver})`);
  if (config.webDist) console.log(`[api] serving web app from ${config.webDist}`);
});

async function shutdown(signal: string) {
  console.log(`[api] ${signal} received, shutting down`);
  server.close();
  // Let catalogue refreshes and the running cover job land before the database goes away.
  await Promise.all([lookup.idle(), covers.close()]);
  await adapter.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
