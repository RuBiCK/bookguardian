import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { API_BASE_URL, ApiClientError, apiRequest } from '../src/api/client';

const schema = z.object({ ok: z.boolean() });

function mockFetch(body: unknown, init: ResponseInit = { status: 200 }) {
  const response =
    typeof body === 'string'
      ? new Response(body, init)
      : new Response(JSON.stringify(body), {
          ...init,
          headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        });
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
}

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses relative URLs by default so the Vite proxy handles /api', () => {
    expect(API_BASE_URL).toBe('');
  });

  it('parses a successful JSON response against the schema', async () => {
    const fetchMock = mockFetch({ ok: true });
    await expect(apiRequest('/api/thing', schema)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/thing',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
    );
  });

  it('serialises a JSON body and sets the content type', async () => {
    const fetchMock = mockFetch({ ok: true });
    await apiRequest('/api/thing', schema, { method: 'POST', body: { title: 'Dune' } });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ title: 'Dune' }),
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    });
  });

  it('turns the API error envelope into ApiClientError', async () => {
    mockFetch(
      { error: { code: 'validation_error', message: 'Invalid query', details: [{ path: ['q'] }] } },
      { status: 422 },
    );
    const promise = apiRequest('/api/thing', schema);
    await expect(promise).rejects.toBeInstanceOf(ApiClientError);
    await expect(promise).rejects.toMatchObject({
      status: 422,
      code: 'validation_error',
      message: 'Invalid query',
      details: [{ path: ['q'] }],
    });
  });

  it('falls back to a generic http_error for non-envelope failures', async () => {
    mockFetch('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' });
    await expect(apiRequest('/api/thing', schema)).rejects.toMatchObject({
      status: 502,
      code: 'http_error',
      message: 'Bad Gateway',
    });
  });

  it('rejects a 2xx response that does not match the schema', async () => {
    mockFetch({ ok: 'yes' });
    await expect(apiRequest('/api/thing', schema)).rejects.toThrow();
  });
});
