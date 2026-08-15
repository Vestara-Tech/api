import { describe, expect, it } from 'vitest';
import { SchemaRegistry } from '../../src/configuration/registry/schema-registry.js';
import { LayeredResolver } from '../../src/configuration/resolver/layered-resolver.js';
import { secretReference, parseSecretRef, isSecretReference } from '../../src/configuration/domain/secret.js';
import { precedenceIndex } from '../../src/configuration/domain/types.js';

describe('SchemaRegistry (CONFIG-002)', () => {
  it('registers definitions and derives leaf keys from defaults', () => {
    const registry = new SchemaRegistry();
    registry.register({
      namespace: 'vestara.api',
      version: '1.0.0',
      schema: {},
      defaults: { host: '127.0.0.1', port: 4310, nested: { enabled: true } },
      scope: ['system', 'runtime'],
    });
    const keys = registry.keys();
    expect(keys.map((k) => k.key)).toContain('vestara.api.port');
    expect(keys.map((k) => k.key)).toContain('vestara.api.nested.enabled');
    expect(keys.find((k) => k.key === 'vestara.api.port')?.defaultValue).toBe(4310);
  });

  it('rejects duplicate namespace registration', () => {
    const registry = new SchemaRegistry();
    registry.register({ namespace: 'vestara.api', version: '1.0.0', schema: {}, defaults: {}, scope: [] });
    expect(() => registry.register({ namespace: 'vestara.api', version: '2.0.0', schema: {}, defaults: {}, scope: [] })).toThrow();
  });

  it('tracks secret fields', () => {
    const registry = new SchemaRegistry();
    registry.register({
      namespace: 'vestara.auth',
      version: '1.0.0',
      schema: {},
      defaults: { primarySecret: '' },
      scope: ['system'],
      secretFields: ['primarySecret'],
    });
    expect(registry.keys().find((k) => k.key === 'vestara.auth.primarySecret')?.secret).toBe(true);
  });
});

describe('LayeredResolver (CONFIG-003)', () => {
  const registry = new SchemaRegistry();
  registry.register({
    namespace: 'vestara.api',
    version: '1.0.0',
    schema: {},
    defaults: { host: '127.0.0.1', port: 4310, logLevel: 'info' },
    scope: ['system', 'environment', 'organization', 'workspace', 'project', 'module', 'service', 'runtime'],
  });

  it('resolves defaults when no layer overrides', () => {
    const resolver = new LayeredResolver(registry, {});
    expect(resolver.resolve('vestara.api.port')?.value).toBe(4310);
    expect(resolver.resolve('vestara.api.port')?.source).toBe('default');
  });

  it('higher-precedence layer wins', () => {
    const resolver = new LayeredResolver(registry, {
      system: { 'vestara.api.port': 4000 },
      environment: { 'vestara.api.port': 5000 },
      workspace: { 'vestara.api.port': 6000 },
    });
    expect(resolver.resolve('vestara.api.port')?.value).toBe(6000);
    expect(resolver.resolve('vestara.api.port')?.scope).toBe('workspace');
  });

  it('runtime overrides take top priority', () => {
    const resolver = new LayeredResolver(registry, { workspace: { 'vestara.api.port': 6000 } });
    expect(resolver.resolve('vestara.api.port', { 'vestara.api.port': 9999 })?.value).toBe(9999);
  });

  it('resolveAll returns one value per key', () => {
    const resolver = new LayeredResolver(registry, {});
    expect(resolver.resolveAll().length).toBe(3);
  });

  it('returns null for unknown keys', () => {
    const resolver = new LayeredResolver(registry, {});
    expect(resolver.resolve('vestara.nope.x')).toBeNull();
  });
});

describe('SecretReference (CONFIG-005)', () => {
  it('creates and parses a secret reference', () => {
    const ref = secretReference('database', 'primary/password');
    expect(ref.ref).toBe('secret://database/primary/password');
    expect(parseSecretRef(ref.ref)).toEqual({ store: 'database', path: 'primary/password' });
    expect(isSecretReference(ref)).toBe(true);
  });

  it('rejects malformed references', () => {
    expect(parseSecretRef('not-a-ref')).toBeNull();
    expect(parseSecretRef('secret://onlystore')).toBeNull();
  });
});

describe('precedence', () => {
  it('orders scopes low to high', () => {
    expect(precedenceIndex('system')).toBeLessThan(precedenceIndex('runtime'));
    expect(precedenceIndex('workspace')).toBeLessThan(precedenceIndex('service'));
  });
});
