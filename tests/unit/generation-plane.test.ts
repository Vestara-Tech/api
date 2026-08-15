import { describe, expect, it } from 'vitest';
import {
  GenerationCapabilityRegistry,
  GenerationPlane,
  generationPlaneContributions,
  type GeneratorPermissionBridge,
} from '../../src/generation-plane/index.js';

function buildPlane(permission?: GeneratorPermissionBridge) {
  const registry = new GenerationCapabilityRegistry();
  for (const c of generationPlaneContributions()) registry.registerContribution(c);
  const plane = new GenerationPlane({ registry, ...(permission ? { permission } : {}) });
  return { registry, plane };
}

describe('GEN-X02 capability registry', () => {
  it('registers contributions and resolves capabilities to generators', () => {
    const { registry } = buildPlane();
    expect(registry.listCapabilities()).toContain('api.resource');
    expect(registry.listCapabilities()).toContain('agent.definition');
    expect(registry.listCapabilities()).toContain('workflow.definition');
    expect(registry.listCapabilities()).toContain('test.api');

    const resolved = registry.resolve('agent.definition');
    expect(resolved.generatorId).toBe('agent.definition');
    expect(resolved.moduleId).toBe('agent');
  });

  it('throws for unknown capabilities', () => {
    const { registry } = buildPlane();
    expect(() => registry.resolve('database.schema')).toThrow(/No generator provides/);
  });
});

describe('GEN-X03 typed intents', () => {
  it('maps intents to capabilities', () => {
    const { plane } = buildPlane();
    expect(plane.intentToCapability({ kind: 'api.endpoint', target: 'users', operation: 'create' })).toBe('api.endpoint');
    expect(plane.intentToCapability({ kind: 'agent.definition', role: 'developer', objective: 'x' })).toBe('agent.definition');
    expect(plane.intentToCapability({ kind: 'test.api', resource: 'users', operations: ['GET'] })).toBe('test.api');
  });

  it('resolves a generator for an intent', () => {
    const { plane } = buildPlane();
    const resolved = plane.resolveGenerator(plane.intentToCapability({ kind: 'agent.definition', role: 'developer', objective: 'x' }));
    expect(resolved.moduleId).toBe('agent');
  });
});

describe('GEN-X08 permission bridge (generate vs apply)', () => {
  it('separates generate and apply authority', async () => {
    const permission: GeneratorPermissionBridge = {
      canGenerate: async () => true,
      canApply: async (_p, capability) => !capability.includes('apply'),
    };
    const { plane } = buildPlane(permission);
    expect(await plane.canGenerate('agent-x', { kind: 'api.resource', name: 'products' })).toBe(true);
    expect(await plane.canApply('agent-x', 'api.resource.apply')).toBe(false);
  });
});

describe('GEN-X10 generator execution through contributions', () => {
  it('produces artifacts from a contribution generator', async () => {
    const { registry } = buildPlane();
    const contribution = registry.getContribution('api.resource');
    const generator = contribution.createGenerator();
    const outcome = await generator.generate({ name: 'Products' });
    expect(outcome.artifacts.all()).toHaveLength(1);
    expect(outcome.artifacts.get('products.schema.json')?.content).toContain('Products');
  });
});
