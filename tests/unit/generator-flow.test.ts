import { describe, expect, it } from 'vitest';
import { GenerationService } from '../../src/generator/service/generation-service.js';
import { GeneratorRegistry } from '../../src/generator/registry/generator-registry.js';
import { createGenerationPlan } from '../../src/generator/domain/plan.js';
import { hashOf } from '../../src/generator/domain/hash.js';
import { ArtifactSet } from '../../src/generator/artifacts/artifact-set.js';
import { ArtifactValidationPipeline } from '../../src/generator/validation/pipeline.js';
import { createConfigurationSnapshot } from '../../src/generator/context/configuration-snapshot.js';
import type { Generator } from '../../src/generator/domain/contracts.js';

const emptyConfig = createConfigurationSnapshot([]);

function makeGenerator(): Generator<{ name: string }, { name: string }> {
  return {
    id: 'generator.template',
    version: '1.0.0',
    capabilities: ['templates'],
    requiresSecrets: false,
    async plan(input) {
      return createGenerationPlan({
        id: 'plan',
        generatorId: 'generator.template',
        inputHash: hashOf(input),
        steps: [{ id: 'render', kind: 'render', description: 'render' }],
        requirements: [{ id: 'name', label: 'name', satisfied: input.name.length > 0 }],
      });
    },
    async generate(input) {
      const artifacts = new ArtifactSet('generator.template', '1.0.0');
      artifacts.add({ path: 'out.txt', content: `hello ${input.name}` });
      return { artifacts, output: { name: input.name } };
    },
  };
}

describe('GenerationService applyFlow (GEN-007..010)', () => {
  it('runs the full governed flow: generate → validate → preview → apply → verify', async () => {
    const registry = new GeneratorRegistry();
    registry.register(makeGenerator());
    const service = new GenerationService({ registry, templates: {} });
    const validation = new ArtifactValidationPipeline([], { maxFileCount: 10 });

    const written = new Map<string, string>();
    const existing = new Map<string, string>();
    const applyPort = {
      async write(path: string, content: string) {
        written.set(path, content);
      },
      async exists(path: string) {
        return written.has(path) || existing.has(path);
      },
    };

    const applied = await service.applyFlow(
      {
        input: { generatorId: 'generator.template', input: { name: 'Products' }, configuration: emptyConfig },
        targetReader: {
          async read(path: string) {
            return existing.get(path) ?? written.get(path) ?? null;
          },
          async exists(path: string) {
            return existing.has(path) || written.has(path);
          },
        },
        previewHash: 'p-1',
      },
      validation,
      applyPort,
      true,
    );

    expect(applied.validation.ok).toBe(true);
    expect(applied.preview.additions).toBe(1);
    expect(applied.preview.totalFiles).toBe(1);
    expect(applied.apply.appliedFiles).toEqual(['out.txt']);
    expect(written.get('out.txt')).toBe('hello Products');
    expect(applied.verification.verified).toBe(true);
    expect(applied.result.evidence.outputHash).toBe(applied.apply.applyHash);
  });

  it('refuses apply when validation fails', async () => {
    const registry = new GeneratorRegistry();
    registry.register(makeGenerator());
    const service = new GenerationService({ registry, templates: {} });
    const validation = new ArtifactValidationPipeline([], { requiredFiles: ['missing.txt'] });
    const applyPort = {
      async write() {},
      async exists() {
        return false;
      },
    };
    await expect(
      service.applyFlow(
        {
          input: { generatorId: 'generator.template', input: { name: 'Products' }, configuration: emptyConfig },
          targetReader: { async read() { return null; }, async exists() { return false; } },
          previewHash: 'p-1',
        },
        validation,
        applyPort,
        true,
      ),
    ).rejects.toThrow(/validation/i);
  });

  it('refuses apply when not approved', async () => {
    const registry = new GeneratorRegistry();
    registry.register(makeGenerator());
    const service = new GenerationService({ registry, templates: {} });
    const validation = new ArtifactValidationPipeline();
    const applyPort = {
      async write() {},
      async exists() {
        return false;
      },
    };
    await expect(
      service.applyFlow(
        {
          input: { generatorId: 'generator.template', input: { name: 'Products' }, configuration: emptyConfig },
          targetReader: { async read() { return null; }, async exists() { return false; } },
          previewHash: 'p-1',
        },
        validation,
        applyPort,
        false,
      ),
    ).rejects.toThrow(/approved/i);
  });
});
