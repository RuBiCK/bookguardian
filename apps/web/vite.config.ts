/// <reference types="vitest/config" />
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Where `/api` is proxied in dev/preview. `API_PROXY_TARGET` only moves the
  // proxy; `VITE_API_URL` is also baked into the bundle, which makes the SPA
  // call the API cross-origin, without its session cookie.
  const apiUrl =
    process.env.API_PROXY_TARGET ??
    process.env.VITE_API_URL ??
    env.VITE_API_URL ??
    'http://localhost:3000';

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
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
          // Never cache API responses in the app shell; server state belongs to TanStack Query.
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
