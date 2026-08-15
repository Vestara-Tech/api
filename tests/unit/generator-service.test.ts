import { describe, expect, it } from 'vitest';
import { GenerationService } from '../../src/generator/service/generation-service.js';
import { GeneratorRegistry } from '../../src/generator/registry/generator-registry.js';
import { createGenerationPlan } from '../../src/generator/domain/plan.js';
import { hashOf } from '../../src/generator/domain/hash.js';
import { ArtifactSet } from '../../src/generator/artifacts/artifact-set.js';
import { createConfigurationSnapshot } from '../../src/generator/context/configuration-snapshot.js';
import { secretReference } from '../../src/configuration/domain/secret.js';
import type { Generator } from '../../src/generator/domain/contracts.js';

const emptyConfig = createConfigurationSnapshot([]);

function makeTemplateGenerator(requiresSecrets: boolean): Generator<{ name: string }, { name: string }> {
  return {
    id: 'generator.template',
    version: '1.0.0',
    capabilities: ['templates'],
    requiresSecrets,
    async plan(input) {
      return createGenerationPlan({
        id: 'plan',
        generatorId: 'generator.template',
        inputHash: hashOf(input),
        steps: [{ id: 'render', kind: 'render', description: 'render' }],
        requirements: [{ id: 'name', label: 'name present', satisfied: input.name.length > 0 }],
      });
    },
    async generate(input) {
      const artifacts = new ArtifactSet('generator.template', '1.0.0');
      artifacts.add({ path: 'out.txt', content: `hello ${input.name}` });
      return { artifacts, output: { name: input.name } };
    },
  };
}

describe('GenerationService (GEN-001..006)', () => {
  it('plans without generating', async () => {
    const registry = new GeneratorRegistry();
    registry.register(makeTemplateGenerator(false));
    const service = new GenerationService({ registry, templates: {} });
    const { plan } = await service.plan({ generatorId: 'generator.template', input: { name: 'Products' }, configuration: emptyConfig });
    expect(plan.steps).toHaveLength(1);
    expect(plan.requirements[0]!.satisfied).toBe(true);
  });

  it('runs a generation and produces artifacts + evidence', async () => {
    const registry = new GeneratorRegistry();
    registry.register(makeTemplateGenerator(false));
    const service = new GenerationService({ registry, templates: {} });
    const result = await service.run<{ name: string }, { name: string }>({
      generatorId: 'generator.template',
      input: { name: 'Products' },
      configuration: emptyConfig,
    });
    expect(result.artifacts.get('out.txt')?.content).toBe('hello Products');
    expect(result.output.name).toBe('Products');
    expect(result.evidence.generatorId).toBe('generator.template');
    expect(result.evidence.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.evidence.configurationHash).toBe(emptyConfig.snapshotHash);
    expect(result.evidence.outputHash).toBe(result.artifacts.outputHash());
  });

  it('is deterministic: same input + config + generator → same evidence', async () => {
    const registry = new GeneratorRegistry();
    registry.register(makeTemplateGenerator(false));
    const service = new GenerationService({ registry, templates: {} });
    const a = await service.run<{ name: string }, { name: string }>({ generatorId: 'generator.template', input: { name: 'Products' }, configuration: emptyConfig });
    const b = await service.run<{ name: string }, { name: string }>({ generatorId: 'generator.template', input: { name: 'Products' }, configuration: emptyConfig });
    expect(a.evidence.evidenceHash).toBe(b.evidence.evidenceHash);
    expect(a.evidence.outputHash).toBe(b.evidence.outputHash);
  });

  it('rejects a generation with unsatisfied plan requirements', async () => {
    const registry = new GeneratorRegistry();
    registry.register(makeTemplateGenerator(false));
    const service = new GenerationService({ registry, templates: {} });
    await expect(
      service.run({ generatorId: 'generator.template', input: { name: '' }, configuration: emptyConfig }),
    ).rejects.toThrow(/unsatisfied/);
  });
});

describe('secret rule (GEN-006)', () => {
  it('a secrets-requiring generator is rejected without policy approval', async () => {
    const registry = new GeneratorRegistry();
    registry.register(makeTemplateGenerator(true));
    const service = new GenerationService({ registry, templates: {} });
    await expect(
      service.run({ generatorId: 'generator.template', input: { name: 'x' }, configuration: emptyConfig }),
    ).rejects.toThrow(/secrets/i);
  });

  it('a secrets-requiring generator runs when policy approves', async () => {
    const registry = new GeneratorRegistry();
    registry.register(makeTemplateGenerator(true));
    const service = new GenerationService({ registry, templates: {} });
    const config = createConfigurationSnapshot([
      { key: 'vestara.auth.primarySecret', value: secretReference('vault', 'primary'), scope: 'system', secret: true },
    ]);
    const result = await service.run<{ name: string }, { name: string }>({
      generatorId: 'generator.template',
      input: { name: 'x' },
      configuration: config,
      policyApprovedSecrets: true,
    });
    expect(result.evidence.configurationHash).toBe(config.snapshotHash);
  });

  it('snapshot exposes secret references, not raw values', () => {
    const snapshot = createConfigurationSnapshot([
      { key: 'vestara.auth.primarySecret', value: secretReference('vault', 'primary'), scope: 'system', secret: true },
      { key: 'vestara.api.port', value: 4310, scope: 'environment', secret: false },
    ]);
    expect(snapshot.secretReferences).toHaveLength(1);
    expect(snapshot.secretReferences[0]!.ref).toBe('secret://vault/primary');
    expect(snapshot.values['vestara.api.port']).toBe(4310);
    expect(snapshot.secretsResolved).toBe(false);
  });
});
