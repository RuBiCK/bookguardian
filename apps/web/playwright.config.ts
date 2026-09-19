import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * Mobile-viewport e2e. The iPhone 14 device descriptor sets the 390x844
 * viewport, device scale factor, touch and mobile UA. It runs on Chromium so
 * CI needs no WebKit system deps; switch `browserName` to 'webkit' locally to
 * exercise Safari-specific behaviour.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'iphone-14',
      use: { ...devices['iPhone 14'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'pnpm run build && pnpm run preview --port 4173 --strictPort',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
