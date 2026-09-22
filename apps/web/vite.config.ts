/// <reference types="vitest/config" />
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Where `/api` is proxied in dev/preview. The SPA only ever uses relative
  // `/api` URLs (one origin, see docs/auth.md), so this moves the proxy and
  // nothing is baked into the bundle.
  const apiUrl = process.env.API_PROXY_TARGET ?? env.API_PROXY_TARGET ?? 'http://localhost:3000';
  // Where this build will be served from. Only the landing page's SEO and
  // sharing tags need it (Open Graph wants absolute URLs and a crawler never
  // runs our JS); nothing in the app depends on the origin. Self-hosters set
  // it to the same value as the API's AUTH_BASE_URL.
  const configuredOrigin = process.env.PUBLIC_ORIGIN ?? env.PUBLIC_ORIGIN ?? '';
  const publicOrigin = (configuredOrigin.trim() || 'https://bookguardian.marcote.net').replace(
    /\/+$/,
    '',
  );

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      {
        name: 'bookguardian-public-origin',
        transformIndexHtml: (html) => html.replaceAll('%PUBLIC_ORIGIN%', publicOrigin),
      },
      // Must run before the React plugin so generated routes are transformed.
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'Bookguardian',
          short_name: 'Bookguardian',
          description: 'Your shelves, in your pocket.',
          start_url: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f7f4ee',
          theme_color: '#f7f4ee',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // The Open Graph card is only ever fetched by crawlers and chat
          // unfurlers, never by the app: no reason to ship it to every device.
          globIgnores: ['og.png'],
          // Never cache API responses in the app shell; server state belongs to
          // TanStack Query. Only the build output is precached and there is no
          // runtimeCaching, so `/api/*` — `/api/auth/me` and `/api/auth/logout`
          // included — always goes to the network, and navigations to /api (the
          // Google sign-in flow and its callback) reach the server, never the
          // SPA shell. Keep it that way: a cached `/me` could resurrect or hide
          // a session, and a service-worker-handled `/api` fetch would also slip
          // past Playwright's request interception in the e2e suite.
          navigateFallbackDenylist: [/^\/api\//],
        },
        devOptions: { enabled: false },
      }),
    ],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': { target: apiUrl, changeOrigin: true },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': { target: apiUrl, changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./test/setup.ts'],
      include: ['test/**/*.test.{ts,tsx}'],
      css: false,
      // Screen tests drive real user events through jsdom; give them headroom on slow CI runners.
      testTimeout: 20_000,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        // Bootstrapping / generated files are exercised by the Playwright smoke test instead.
        exclude: ['src/main.tsx', 'src/routeTree.gen.ts', 'src/vite-env.d.ts', 'src/i18next.d.ts'],
        reporter: ['text', 'lcov'],
        thresholds: { lines: 90, functions: 85, branches: 80, statements: 90 },
      },
    },
  };
});
