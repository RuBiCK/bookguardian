import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 4173;
const API_PORT = 3100;

/**
 * Mobile-viewport e2e. The iPhone 14 device descriptor sets the 390px
 * viewport, device scale factor, touch and mobile UA. It runs on Chromium so
 * CI needs no WebKit system deps; switch `browserName` to 'webkit' locally to
 * exercise Safari-specific behaviour.
 *
 * Two servers are started: the API (SQLite in a temp dir, migrated at boot)
 * and the built web app served by `vite preview`, which proxies /api to it.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
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
      command: 'pnpm --filter @bookguardian/api exec tsx src/index.ts',
      url: `http://localhost:${API_PORT}/api/health?shallow=true`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        DB_DRIVER: 'sqlite',
        DATABASE_PATH: join(mkdtempSync(join(tmpdir(), 'bookguardian-e2e-')), 'e2e.db'),
      },
    },
    {
      command: `pnpm run build && pnpm run preview --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});
