import { describe, expect, it } from 'vitest';
import { GeneratorRegistry } from '../../src/generator/registry/generator-registry.js';
import { createGenerationPlan } from '../../src/generator/domain/plan.js';
import { hashOf } from '../../src/generator/domain/hash.js';
import { ArtifactSet } from '../../src/generator/artifacts/artifact-set.js';
import type { Generator } from '../../src/generator/domain/contracts.js';

function makeGenerator(id: string, capabilities: string[]): Generator {
  return {
    id,
    version: '1.0.0',
    capabilities,
    requiresSecrets: false,
    async plan() {
      return createGenerationPlan({ id: `plan-${id}`, generatorId: id, inputHash: hashOf({}), steps: [], requirements: [] });
    },
    async generate() {
      return { artifacts: new ArtifactSet(id, '1.0.0'), output: {} };
    },
  };
}

describe('GeneratorRegistry (GEN-002)', () => {
  it('registers and retrieves generators', () => {
    const registry = new GeneratorRegistry();
    registry.register(makeGenerator('generator.api', ['generator.api']));
    expect(registry.has('generator.api')).toBe(true);
    expect(registry.get('generator.api').id).toBe('generator.api');
    expect(() => registry.register(makeGenerator('generator.api', []))).toThrow();
  });

  it('unregisters and rejects unknown ids', () => {
    const registry = new GeneratorRegistry();
    registry.register(makeGenerator('a', []));
    expect(registry.unregister('a')).toBe(true);
    expect(registry.has('a')).toBe(false);
    expect(() => registry.get('a')).toThrow();
  });

  it('discovers generators by capability', () => {
    const registry = new GeneratorRegistry();
    registry.register(makeGenerator('generator.api', ['generator.api']));
    registry.register(makeGenerator('generator.database', ['generator.database']));
    const found = registry.discover(['generator.api']);
    expect(found.map((g) => g.id)).toEqual(['generator.api']);
  });

  it('reports capabilities across all generators', () => {
    const registry = new GeneratorRegistry();
    registry.register(makeGenerator('a', ['x', 'y']));
    registry.register(makeGenerator('b', ['y', 'z']));
    expect(registry.capabilities()).toEqual(['x', 'y', 'z']);
  });

  it('computes compatibility against provided capabilities', () => {
    const registry = new GeneratorRegistry();
    registry.register(makeGenerator('generator.api', ['generator.api', 'templates']));
    expect(registry.compatibility('generator.api', ['generator.api', 'templates']).compatible).toBe(true);
    expect(registry.compatibility('generator.api', ['templates']).compatible).toBe(false);
  });
});
