import { describe, expect, it } from 'vitest';
import { ConfigurationService } from '../../src/configuration/service/configuration-service.js';
import { SchemaRegistry } from '../../src/configuration/registry/schema-registry.js';
import { ConfigurationValidator } from '../../src/configuration/validation/validator.js';
import { ConfigurationEventBus } from '../../src/configuration/events/event-bus.js';
import { InMemoryRevisionStore } from '../../src/configuration/lifecycle/revision-store.js';
import { secretReference } from '../../src/configuration/domain/secret.js';

function build() {
  const registry = new SchemaRegistry();
  registry.register({
    namespace: 'vestara.api',
    version: '1.0.0',
    schema: { type: 'object', properties: { port: { type: 'integer' }, logLevel: { type: 'string' } } },
    defaults: { port: 4310, logLevel: 'info' },
    scope: ['system', 'environment', 'workspace'],
  });
  registry.register({
    namespace: 'vestara.auth',
    version: '1.0.0',
    schema: { type: 'object', properties: { primarySecret: { type: 'string' } } },
    defaults: {},
    scope: ['system'],
    secretFields: ['primarySecret'],
  });
  const events = new ConfigurationEventBus();
  const service = new ConfigurationService({
    registry,
    validator: new ConfigurationValidator((schema, value) => {
      const s = schema as { type?: string };
      if (s.type === 'integer' && typeof value === 'number') return [];
      return [];
    }),
    revisionStore: new InMemoryRevisionStore(),
    layers: {},
    events,
  });
  return { service, events };
}

describe('ConfigurationService lifecycle (CONFIG-006)', () => {
  it('resolves defaults and runtime overrides', () => {
    const { service } = build();
    expect(service.resolve('vestara.api.port')?.value).toBe(4310);
    service.setRuntimeOverride('vestara.api.port', 9999);
    expect(service.resolve('vestara.api.port')?.value).toBe(9999);
    service.clearRuntimeOverride('vestara.api.port');
    expect(service.resolve('vestara.api.port')?.value).toBe(4310);
  });

  it('draft → validate → apply emits change events and records a revision', async () => {
    const { service, events } = build();
    const seen: string[] = [];
    events.subscribe('workspace', (e) => seen.push(`${e.kind}:${e.key}`));

    const draft = await service.draft({ scope: 'workspace', values: { 'vestara.api.port': 6000 } });
    const validation = await service.validateDraft(draft.id);
    expect(validation.ok).toBe(true);

    const applied = await service.apply(draft.id, 'eddie');
    expect(applied.status).toBe('applied');
    expect(service.resolve('vestara.api.port')?.value).toBe(6000);
    expect(seen).toContain('create:vestara.api.port');

    const revisions = await service.revisions('workspace');
    expect(revisions).toHaveLength(1);
    expect(revisions[0]!.appliedBy).toBe('eddie');
  });

  it('rejects applying an invalid draft', async () => {
    const { service } = build();
    const draft = await service.draft({
      scope: 'workspace',
      values: { 'vestara.auth.primarySecret': 'literal-secret-value' },
    });
    await expect(service.apply(draft.id)).rejects.toThrow(/secret/i);
  });

  it('rollback clears the scope layer and emits rollback events', async () => {
    const { service, events } = build();
    const seen: string[] = [];
    events.subscribe('workspace', (e) => seen.push(e.kind));

    const draft = await service.draft({ scope: 'workspace', values: { 'vestara.api.port': 6000 } });
    await service.apply(draft.id);

    const rolledBack = await service.rollback('workspace');
    expect(rolledBack?.status).toBe('superseded');
    expect(service.resolve('vestara.api.port')?.value).toBe(4310); // back to default
    expect(seen).toContain('rollback');
  });
});

describe('ConfigurationService secret handling (CONFIG-005)', () => {
  it('allows secret fields to hold secret references', async () => {
    const { service } = build();
    const draft = await service.draft({
      scope: 'system',
      values: { 'vestara.auth.primarySecret': secretReference('vault', 'primary') },
    });
    const validation = await service.validateDraft(draft.id);
    expect(validation.ok).toBe(true);
    const applied = await service.apply(draft.id);
    expect(applied.status).toBe('applied');
  });
});
