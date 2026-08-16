import { describe, expect, it } from 'vitest';
import { marketplaceApi } from '../src/api/marketplaceApi';

describe('marketplace API client', () => {
  it('exposes the full API surface', () => {
    expect(typeof marketplaceApi.packages).toBe('function');
    expect(typeof marketplaceApi.package).toBe('function');
    expect(typeof marketplaceApi.categories).toBe('function');
    expect(typeof marketplaceApi.installed).toBe('function');
    expect(typeof marketplaceApi.install).toBe('function');
    expect(typeof marketplaceApi.enable).toBe('function');
    expect(typeof marketplaceApi.disable).toBe('function');
    expect(typeof marketplaceApi.update).toBe('function');
    expect(typeof marketplaceApi.uninstall).toBe('function');
  });

  it('builds query strings for search + kind', async () => {
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    try {
      await marketplaceApi.packages('github');
      await marketplaceApi.packages(undefined, 'agent');
      expect(calls).toContain('/api/v2/marketplace/packages?search=github');
      expect(calls).toContain('/api/v2/marketplace/packages?kind=agent');
    } finally {
      globalThis.fetch = original;
    }
  });
});
