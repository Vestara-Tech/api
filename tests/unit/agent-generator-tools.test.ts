import { describe, expect, it } from 'vitest';
import {
  GeneratorRegistry,
  GenerationService,
  createConfigurationSnapshot,
  type GenerationContext,
  type GenerationPlan,
  type GenerationOutcome,
  ArtifactSet,
} from '../../src/generator/index.js';
import { ToolRegistry, ToolRuntime, ToolPolicy, generatorToolContributions } from '../../src/tool/index.js';

function makeGenerator() {
  return {
    id: 'generator.template',
    version: '1.0.0',
    capabilities: ['templates', 'fs.apply'],
    requiresSecrets: false,
    plan: async (_input: unknown, _ctx: GenerationContext): Promise<GenerationPlan> => ({
      steps: [{ id: 'step1', kind: 'transform', description: 'render template', inputs: ['input'], outputs: ['out.txt'], satisfied: true }],
      requirements: [],
      warnings: [],
    }),
    generate: async (input: { name?: string }, _ctx: GenerationContext): Promise<GenerationOutcome<{ name: string }>> => {
      const artifacts = new ArtifactSet('generator.template', '1.0.0');
      artifacts.add({ path: 'out.txt', content: `hello ${(input as { name: string }).name ?? 'world'}` });
      return { artifacts, output: { name: input.name ?? 'world' } };
    },
  };
}

describe('AGENT-013 generator tools (Generate ≠ Write)', () => {
  it('contributes list/plan/run/preview/apply tools with correct risk', () => {
    const registry = new GeneratorRegistry();
    registry.register(makeGenerator());
    const service = new GenerationService({ registry, templates: {} });
    const tools = new ToolRegistry();
    for (const c of generatorToolContributions(registry, service, createConfigurationSnapshot([]))) {
      tools.registerContribution(c);
    }
    expect(tools.has('generator.list')).toBe(true);
    expect(tools.has('generator.plan')).toBe(true);
    expect(tools.has('generator.run')).toBe(true);
    expect(tools.has('generator.preview')).toBe(true);
    expect(tools.has('generator.apply')).toBe(true);
    expect(tools.get('generator.apply').risk).toBe('control');
    expect(tools.get('generator.run').risk).toBe('write');
  });

  it('runs a generator through the tool with the snapshot config', async () => {
    const registry = new GeneratorRegistry();
    registry.register(makeGenerator());
    const service = new GenerationService({ registry, templates: {} });
    const tools = new ToolRegistry();
    for (const c of generatorToolContributions(registry, service, createConfigurationSnapshot([]))) {
      tools.registerContribution(c);
    }
    const toolRuntime = new ToolRuntime({ registry: tools, policy: new ToolPolicy({ autoApproveRisks: ['read', 'write'] }) });

    const result = await toolRuntime.execute('agent-x', 'run-1', 'generator.run', { generatorId: 'generator.template', input: { name: 'Products' } });
    expect(result.ok).toBe(true);
    const output = result.output as { artifacts: readonly { path: string }[] };
    expect(output.artifacts).toHaveLength(1);
    expect(output.artifacts[0]!.path).toBe('out.txt');
  });

  it('requires approval for generator.apply (governed apply)', async () => {
    const registry = new GeneratorRegistry();
    registry.register(makeGenerator());
    const service = new GenerationService({ registry, templates: {} });
    const tools = new ToolRegistry();
    for (const c of generatorToolContributions(registry, service, createConfigurationSnapshot([]))) {
      tools.registerContribution(c);
    }
    const toolRuntime = new ToolRuntime({ registry: tools, policy: new ToolPolicy({ autoApproveRisks: ['read', 'write'] }) });

    await expect(
      toolRuntime.execute('agent-x', 'run-1', 'generator.apply', { generatorId: 'generator.template', input: {} }),
    ).rejects.toThrow(/requires human approval/);

    const approved = await toolRuntime.execute('agent-x', 'run-1', 'generator.apply', { generatorId: 'generator.template', input: {} }, { approved: true, authorizedBy: 'user-1' });
    expect(approved.ok).toBe(true);
  });
});
