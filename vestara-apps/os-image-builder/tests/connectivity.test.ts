import { describe, expect, it } from 'vitest';
import { ApiClient, ApiError, createImageApi } from '@vestara/client';

describe('os-image-builder connectivity (shared client)', () => {
  it('classifies an unreachable API as offline (not a generic error)', async () => {
    const client = new ApiClient({ apiBase: 'http://127.0.0.1:1', timeoutMs: 500 });
    const result = await client.health();
    expect(result.ok).toBe(false);
    expect(result.state.status).toBe('offline');
  });

  it('classifies 404 as not_found through the image API', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: 'missing' } }), { status: 404, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    try {
      const client = new ApiClient({ apiBase: 'http://x' });
      const api = createImageApi(client);
      const err = (await api.listProfiles().catch((e: unknown) => e)) as ApiError;
      expect(err.code).toBe('not_found');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('classifies a 500 as server_error with retryable semantics', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: 'boom', retryable: true } }), { status: 500, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    try {
      const client = new ApiClient({ apiBase: 'http://x' });
      const err = (await client.request('/api/v2/image/profiles').catch((e: unknown) => e)) as ApiError;
      expect(err.code).toBe('server_error');
      expect(err.retryable).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});
