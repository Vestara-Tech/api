import { describe, expect, it } from 'vitest';
import { ApiClient, ApiError, resolveApiBase, DEFAULT_API_BASE } from '../src/index';

describe('ApiClient error classification', () => {
  it('defaults the API base to the backend default port', () => {
    expect(DEFAULT_API_BASE).toContain(':4310');
    expect(resolveApiBase()).toBe(DEFAULT_API_BASE);
  });

  it('throws offline for network failures', async () => {
    const client = new ApiClient({ apiBase: 'http://127.0.0.1:1' });
    await expect(client.request('/api/v2/system')).rejects.toMatchObject({ code: 'offline' });
  });

  it('throws timeout when the request exceeds the timeout', async () => {
    // A deliberately slow endpoint via a small timeout.
    const client = new ApiClient({ apiBase: 'http://127.0.0.1:4310', timeoutMs: 1 });
    await expect(client.request('/api/v2/system')).rejects.toMatchObject({ code: 'timeout' });
  });

  it('classifies 404 as not_found with a status', async () => {
    // 4310 not running -> offline; to test 404 we point at a real HTTP server.
    // Use a data: fetch is not supported, so simulate via a stub fetch.
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: 'nope', requestId: 'req_1' } }), { status: 404, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    try {
      const client = new ApiClient({ apiBase: 'http://x' });
      await expect(client.request('/missing')).rejects.toMatchObject({ code: 'not_found', status: 404, requestId: 'req_1' });
    } finally {
      globalThis.fetch = original;
    }
  });

  it('returns the error body message', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: 'boom', retryable: true } }), { status: 500, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    try {
      const client = new ApiClient({ apiBase: 'http://x' });
      const err = (await client.request('/api').catch((e: unknown) => e)) as ApiError;
      expect(err.code).toBe('server_error');
      expect(err.message).toBe('boom');
      expect(err.retryable).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});
