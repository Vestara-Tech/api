import { describe, expect, it } from 'vitest';
import { ContractCompiler, CONTRACT_COMPILER_VERSION } from '../../src/builder/compiler/index.js';
import { hashContract, stableStringify } from '../../src/builder/compiler/hash.js';
import { makeProductDefinition } from '../helpers/definition.js';

const compiler = new ContractCompiler();

describe('ContractCompiler', () => {
  it('compiles OpenAPI 3.1 with resources and endpoints', () => {
    const compiled = compiler.compile(makeProductDefinition());
    expect(compiled.compilerVersion).toBe(CONTRACT_COMPILER_VERSION);
    expect(compiled.openapi.openapi).toBe('3.1.0');
    expect((compiled.openapi.components as { schemas: Record<string, unknown> }).schemas.Product).toBeDefined();
    expect(Object.keys(compiled.openapi.paths as Record<string, unknown>)).toContain('/products');
  });

  it('is deterministic: same definition → same hash', () => {
    const a = compiler.compile(makeProductDefinition());
    const b = compiler.compile(makeProductDefinition());
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hash changes when the definition changes', () => {
    const base = compiler.compile(makeProductDefinition());
    const changed = compiler.compile(
      makeProductDefinition({ version: '2.0.0' }),
    );
    expect(changed.hash).not.toBe(base.hash);
  });

  it('stableStringify is order-independent', () => {
    const a = stableStringify({ b: 1, a: 2 });
    const b = stableStringify({ a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('hashContract mixes in the compiler version', () => {
    const payload = { hello: 'world' };
    expect(hashContract(payload, '1.0.0')).not.toBe(hashContract(payload, '2.0.0'));
  });

  it('compiles route definitions with policies and capability bindings', () => {
    const compiled = compiler.compile(
      makeProductDefinition({
        endpoints: [
          {
            id: 'ep1',
            method: 'GET',
            path: '/products',
            responses: [{ status: 200, resource: 'Product' }],
            policyIds: ['pol_read'],
            capabilityBinding: 'catalog.read',
          },
        ],
      }),
    );
    expect(compiled.routes[0]).toMatchObject({
      method: 'GET',
      path: '/products',
      policyIds: ['pol_read'],
      capabilityBinding: 'catalog.read',
      resource: 'Product',
    });
  });
});
