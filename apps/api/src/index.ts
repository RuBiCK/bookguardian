import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './config';
import { createAdapter } from './db/adapters';
import { migrate } from './db/migrate';
import { createRepositories } from './db/repositories';
import { seed } from './db/seed';
import { version } from './version';

const config = loadConfig();
const adapter = createAdapter(config.db);

// Apply pending migrations at boot so `pnpm dev` on a fresh clone just works.
const migrated = await migrate(adapter);
if (migrated.applied.length > 0) {
  console.log(`[api] applied ${migrated.applied.length} migration(s)`);
}
// A fresh install already has "My Library" with a "Default" shelf (idempotent).
const seeded = await seed(adapter);
if (seeded.created) console.log('[api] seeded default user, library and shelf');

const app = createApp({
  services: { adapter, repos: createRepositories(adapter), version },
  webDist: config.webDist,
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port} (db: ${adapter.driver})`);
  if (config.webDist) console.log(`[api] serving web app from ${config.webDist}`);
});

async function shutdown(signal: string) {
  console.log(`[api] ${signal} received, shutting down`);
  server.close();
  await adapter.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
