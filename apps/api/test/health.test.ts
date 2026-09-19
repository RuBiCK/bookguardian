import { healthResponseSchema } from '@bookguardian/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp, type App } from '../src/app';
import type { DatabaseAdapter } from '../src/db/adapters';
import { createRepositories } from '../src/db/repositories';
import { createTestDb, type TestDb } from './adapters';
import { fixtureLookup } from './lookup-fixtures';

function appFor(adapter: DatabaseAdapter): App {
  return createApp({
    quiet: true,
    services: {
      adapter,
      repos: createRepositories(adapter),
      lookup: fixtureLookup().service,
      version: '0.0.0-test',
    },
  });
}

describe('GET /api/health', () => {
  let db: TestDb;
  let app: App;

  beforeAll(async () => {
    db = await createTestDb();
    app = appFor(db.adapter);
  });
  afterAll(async () => {
    await db.cleanup();
  });

  it('reports the active driver and database reachability', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = healthResponseSchema.parse(await res.json());
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.0.0-test');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.database).toEqual({ driver: 'sqlite', reachable: true });
  });

  it('skips the database ping when ?shallow=true', async () => {
    const ping = vi.spyOn(db.adapter, 'ping');
    const res = await app.request('/api/health?shallow=true');
    expect(res.status).toBe(200);
    expect(ping).not.toHaveBeenCalled();
    ping.mockRestore();
  });

  it('returns 503 + degraded when the database is unreachable', async () => {
    const broken: DatabaseAdapter = { ...db.adapter, ping: async () => false };
    const res = await appFor(broken).request('/api/health');
    expect(res.status).toBe(503);
    const body = healthResponseSchema.parse(await res.json());
    expect(body.status).toBe('degraded');
    expect(body.database.reachable).toBe(false);
  });

  it('validates query parameters with the shared error envelope', async () => {
    const res = await app.request('/api/health?shallow=maybe');
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      error: { code: string; message: string; details: { path: string[] }[] };
    };
    expect(body.error.code).toBe('validation_error');
    expect(body.error.message).toBe('Invalid query');
    expect(body.error.details[0]?.path).toEqual(['shallow']);
  });

  it('returns the error envelope for unknown routes', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('not_found');
    expect(body.error.message).toContain('GET /api/nope');
  });

  it('answers CORS preflight on /api routes', async () => {
    const res = await app.request('/api/health', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('sets security headers', async () => {
    const res = await app.request('/api/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });
});
