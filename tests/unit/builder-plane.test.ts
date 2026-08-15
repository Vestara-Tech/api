import { describe, expect, it } from 'vitest';
import { BuilderRegistry, BuilderStore, BuilderLifecycle, BuilderCompatibilityAnalyzer, apiBuilderContribution, apiComparator } from '../../src/builder-plane/index.js';
import { makeProductDefinition } from '../helpers/definition.js';

function buildPlane() {
  const registry = new BuilderRegistry();
  registry.register(apiBuilderContribution);
  const store = new BuilderStore();
  const lifecycle = new BuilderLifecycle(store, registry);
  return { registry, store, lifecycle };
}

describe('BLD-X04 builder registry', () => {
  it('registers the API builder contribution and lists kinds', () => {
    const { registry } = buildPlane();
    expect(registry.has('api')).toBe(true);
    expect(registry.listKinds().some((k) => k.kind === 'api')).toBe(true);
    expect(registry.resolve('api').generatorCapabilities).toContain('api.resource');
    expect(registry.resolve('api').preferredEditor).toBe('canvas');
  });
});

describe('BLD-X01/05 generic definition + store', () => {
  it('creates a kind-agnostic definition', () => {
    const { store } = buildPlane();
    const def = store.create({ id: 'api_orders', kind: 'api', name: 'Orders API', spec: makeProductDefinition() });
    expect(def.kind).toBe('api');
    expect(def.revision).toBe(0);
    expect(def.status).toBe('draft');
    expect(def.spec.id).toBe('api_prod123');
  });
});

describe('BLD-X02 lifecycle (validate -> ready -> published + revision)', () => {
  it('validates and publishes, recording a revision', () => {
    const { store, lifecycle } = buildPlane();
    const def = store.create({ id: 'api_orders', kind: 'api', name: 'Orders API', spec: makeProductDefinition() });
    const validated = lifecycle.validate('api_orders');
    expect(validated.status).toBe('ready');
    const published = lifecycle.publish('api_orders');
    expect(published.status).toBe('published');
    expect(published.revision).toBe(1);
    expect(store.listRevisions('api_orders')).toHaveLength(1);
    lifecycle.archive('api_orders');
    expect(store.get('api_orders').status).toBe('archived');
  });

  it('marks invalid definitions as invalid', () => {
    const { store, lifecycle } = buildPlane();
    const bad = makeProductDefinition({ version: 'latest' });
    store.create({ id: 'api_bad', kind: 'api', name: 'Bad', spec: bad });
    expect(lifecycle.validate('api_bad').status).toBe('invalid');
  });
});

describe('BLD-X08 generic compatibility analyzer', () => {
  it('uses the API comparator to detect breaking changes', () => {
    const analyzer = new BuilderCompatibilityAnalyzer<ReturnType<typeof makeProductDefinition>>();
    analyzer.registerComparator('api', apiComparator);
    const baseline = makeProductDefinition();
    const candidate = makeProductDefinition();
    // Remove an endpoint -> breaking.
    candidate.endpoints = candidate.endpoints.filter((e) => !e.path.includes('/products'));
    const result = analyzer.analyze('api', candidate, baseline);
    expect(result.classification).toBe('breaking');
    expect(result.changes.some((c) => c.severity === 'breaking')).toBe(true);
  });
});
