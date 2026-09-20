import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 4173;
const API_PORT = 3100;
const STUB_PORT = 3101;
const tmp = mkdtempSync(join(tmpdir(), 'bookguardian-e2e-'));
// Signed-in browser state produced by `e2e/global-setup.ts`. Workers re-evaluate
// this file (and get their own `tmp`), so the path travels through the environment.
const storageState = process.env.E2E_STORAGE_STATE ?? join(tmp, 'storage-state.json');
process.env.E2E_STORAGE_STATE = storageState;

/**
 * Mobile-viewport e2e. The iPhone 14 device descriptor sets the 390px
 * viewport, device scale factor, touch and mobile UA. It runs on Chromium so
 * CI needs no WebKit system deps; switch `browserName` to 'webkit' locally to
 * exercise Safari-specific behaviour.
 *
 * Three servers are started: a stand-in for Open Library (`providers-stub.mjs`,
 * so the cover cascade runs end to end without the network), the API (SQLite
 * and covers in a temp dir, migrated and seeded with the local user, providers
 * pointed at the stub, NODE_ENV=test for the sign-in seam) and the built web
 * app served by `vite preview`, which proxies /api to it. `global-setup.ts`
 * signs in once and every test starts from that session.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    storageState,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'iphone-14',
      use: { ...devices['iPhone 14'], browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'node e2e/providers-stub.mjs',
      url: `http://localhost:${STUB_PORT}/__stub/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { PORT: String(STUB_PORT) },
    },
    {
      command: [
        'pnpm --filter @bookguardian/api exec tsx src/cli/migrate.ts',
        'pnpm --filter @bookguardian/api exec tsx src/cli/seed.ts --local-user',
        'pnpm --filter @bookguardian/api exec tsx src/index.ts',
      ].join(' && '),
      url: `http://localhost:${API_PORT}/api/health?shallow=true`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DB_DRIVER: 'sqlite',
        DATABASE_PATH: join(tmp, 'e2e.db'),
        COVERS_DIR: join(tmp, 'covers'),
        OPEN_LIBRARY_URL: `http://localhost:${STUB_PORT}`,
        OPEN_LIBRARY_COVERS_URL: `http://localhost:${STUB_PORT}`,
        // No pacing, and misses expire at once so the backfill re-checks them.
        COVERS_MIN_INTERVAL_MS: '0',
        COVERS_MISS_DAYS: '0',
      },
    },
    {
      command: `pnpm run build && pnpm run preview --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Proxy target only: the SPA keeps relative /api URLs, so the session
      // cookie set through the proxy is sent back through it.
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
