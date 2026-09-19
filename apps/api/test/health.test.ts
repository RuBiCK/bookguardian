import { healthResponseSchema } from '@bookguardian/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app';
import { createRepositories } from '../src/db/repositories';
import { createTestDb, type TestDb } from './helpers';

describe('GET /api/health', () => {
  let db: TestDb;
  let app: App;

  beforeAll(async () => {
    db = await createTestDb();
    app = createApp({
      quiet: true,
      services: {
        adapter: db.adapter,
        repos: createRepositories(db.adapter),
        version: '0.0.0-test',
      },
    });
  });
  afterAll(async () => {
    await db.cleanup();
  });

  it('reports the active driver and database reachability', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(await res.json());
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.0.0-test');
    expect(body.database).toEqual({ driver: 'sqlite', reachable: true });
  });

  it('validates query parameters with the shared error envelope', async () => {
    const res = await app.request('/api/health?shallow=maybe');
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('returns the error envelope for unknown routes', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('not_found');
  });
});
