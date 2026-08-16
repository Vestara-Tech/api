import { describe, expect, it } from 'vitest';
import { marketplaceV2Api } from '../src/api/marketplaceV2Api';

describe('marketplace v2 API client (MKTUI)', () => {
  it('exposes the full v2 surface', () => {
    expect(typeof marketplaceV2Api.contributions).toBe('function');
    expect(typeof marketplaceV2Api.provides).toBe('function');
    expect(typeof marketplaceV2Api.registerContribution).toBe('function');
    expect(typeof marketplaceV2Api.resolve).toBe('function');
    expect(typeof marketplaceV2Api.bundles).toBe('function');
    expect(typeof marketplaceV2Api.createBundle).toBe('function');
    expect(typeof marketplaceV2Api.distributions).toBe('function');
    expect(typeof marketplaceV2Api.createDistribution).toBe('function');
    expect(typeof marketplaceV2Api.planDistribution).toBe('function');
    expect(typeof marketplaceV2Api.versions).toBe('function');
    expect(typeof marketplaceV2Api.publishVersion).toBe('function');
    expect(typeof marketplaceV2Api.promoteVersion).toBe('function');
    expect(typeof marketplaceV2Api.setUpdatePolicy).toBe('function');
    expect(typeof marketplaceV2Api.evaluateUpdate).toBe('function');
    expect(typeof marketplaceV2Api.impact).toBe('function');
    expect(typeof marketplaceV2Api.publishers).toBe('function');
    expect(typeof marketplaceV2Api.registerPublisher).toBe('function');
    expect(typeof marketplaceV2Api.publish).toBe('function');
    expect(typeof marketplaceV2Api.published).toBe('function');
  });

  it('targets the v2 marketplace routes', () => {
    const calls = new Set<string>();
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.add(String(input));
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    try {
      return Promise.all([
        marketplaceV2Api.contributions(),
        marketplaceV2Api.publishers(),
        marketplaceV2Api.published(),
        marketplaceV2Api.bundles(),
        marketplaceV2Api.distributions(),
        marketplaceV2Api.provides('ai.agent'),
        marketplaceV2Api.versions('pkg.a'),
        marketplaceV2Api.planDistribution('dist-1'),
      ]).then(() => {
        expect(calls).toContain('/api/v2/marketplace-v2/contributions');
        expect(calls).toContain('/api/v2/marketplace-v2/publishers');
        expect(calls).toContain('/api/v2/marketplace-v2/published');
        expect(calls).toContain('/api/v2/marketplace-v2/bundles');
        expect(calls).toContain('/api/v2/marketplace-v2/distributions');
        expect(calls).toContain('/api/v2/marketplace-v2/provides/ai.agent');
        expect(calls).toContain('/api/v2/marketplace-v2/versions/pkg.a');
        expect(calls).toContain('/api/v2/marketplace-v2/distributions/dist-1/plan');
      });
    } finally {
      globalThis.fetch = original;
    }
  });
});
