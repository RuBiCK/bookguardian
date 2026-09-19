import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { NotFoundError } from '../src/db/repositories';
import { ApiHttpError, notFound, onError } from '../src/errors';
import { validate } from '../src/validation';

interface Envelope {
  error: { code: string; message: string; details?: unknown };
}

function appThrowing(error: unknown) {
  const app = new Hono();
  app.get('/', () => {
    throw error;
  });
  app.onError(onError);
  app.notFound(notFound);
  return app;
}

describe('onError', () => {
  it('maps ApiHttpError to its status, code and details', async () => {
    const res = await appThrowing(
      new ApiHttpError(409, 'conflict', 'Already exists', { id: 'x' }),
    ).request('/');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: 'conflict', message: 'Already exists', details: { id: 'x' } },
    });
  });

  it('omits details when none were given', async () => {
    const res = await appThrowing(new ApiHttpError(403, 'forbidden', 'Nope')).request('/');
    expect(await res.json()).toEqual({ error: { code: 'forbidden', message: 'Nope' } });
  });

  it('maps ZodError to 422 with issues', async () => {
    const result = z.object({ n: z.number() }).safeParse({ n: 'x' });
    const res = await appThrowing(result.error).request('/');
    expect(res.status).toBe(422);
    const body = (await res.json()) as Envelope;
    expect(body.error.code).toBe('validation_error');
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it('maps NotFoundError to 404', async () => {
    const res = await appThrowing(new NotFoundError('Book', 'abc')).request('/');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'not_found', message: 'Book abc not found' },
    });
  });

  it('maps plain HTTPException to its status', async () => {
    const res = await appThrowing(new HTTPException(401, { message: 'Unauthorized' })).request('/');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'http_error', message: 'Unauthorized' } });
  });

  it('hides unexpected errors behind a generic 500 and logs them', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const res = await appThrowing(new Error('secret db password leaked')).request('/');
      expect(res.status).toBe(500);
      const body = (await res.json()) as Envelope;
      expect(body.error).toEqual({ code: 'internal_error', message: 'Internal server error' });
      expect(log).toHaveBeenCalledWith('[api] unhandled error', expect.any(Error));
    } finally {
      log.mockRestore();
    }
  });
});

describe('validate', () => {
  const app = new Hono()
    .post(
      '/items/:id',
      validate('param', z.object({ id: z.uuid() })),
      validate('json', z.object({ qty: z.number().int().positive() })),
      (c) => c.json({ id: c.req.valid('param').id, qty: c.req.valid('json').qty }),
    )
    .get('/search', validate('query', z.object({ q: z.string().min(2) })), (c) =>
      c.json(c.req.valid('query')),
    );

  it('passes validated params, body and query through', async () => {
    const id = '0f3e2b8a-7d3c-4b2f-9a11-6f5e4d3c2b1a';
    const res = await app.request(`/items/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qty: 3 }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id, qty: 3 });

    const q = await app.request('/search?q=du');
    expect(await q.json()).toEqual({ q: 'du' });
  });

  it('rejects invalid params with the envelope naming the target', async () => {
    const res = await app.request('/items/not-a-uuid', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qty: 3 }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as Envelope;
    expect(body.error).toMatchObject({ code: 'validation_error', message: 'Invalid param' });
  });

  it('rejects an invalid body', async () => {
    const res = await app.request('/items/0f3e2b8a-7d3c-4b2f-9a11-6f5e4d3c2b1a', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qty: -1 }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as Envelope;
    expect(body.error.message).toBe('Invalid json');
    expect(body.error.details).toEqual([expect.objectContaining({ path: ['qty'] })]);
  });

  it('rejects an invalid query', async () => {
    const res = await app.request('/search?q=d');
    expect(res.status).toBe(422);
  });
});
