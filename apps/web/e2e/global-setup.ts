import { request, type FullConfig } from '@playwright/test';

/**
 * Every e2e test runs signed in. The API is started with NODE_ENV=test, which
 * registers `POST /api/auth/test-login` (nothing else about auth changes), so
 * one sign-in here becomes the storage state every browser context starts
 * from. The first sign-in claims the seeded local user, so the tests keep
 * finding "My Library › Default".
 */
export const E2E_USER = { email: 'e2e@bookguardian.test', name: 'E2E Tester' };

export default async function globalSetup(config: FullConfig) {
  const project = config.projects[0];
  const baseURL = project?.use.baseURL;
  const storageState = process.env.E2E_STORAGE_STATE;
  if (!baseURL || !storageState) throw new Error('baseURL / E2E_STORAGE_STATE not configured');

  const api = await request.newContext({ baseURL });
  const res = await api.post('/api/auth/test-login', { data: E2E_USER });
  if (!res.ok()) {
    throw new Error(`test-login failed: ${res.status()} ${await res.text()}`);
  }
  await api.storageState({ path: storageState });
  await api.dispose();
}
