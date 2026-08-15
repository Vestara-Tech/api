import type { GenerationService, RunGenerationInput } from '../../generator/service/generation-service.js';
import type { GeneratorRegistry } from '../../generator/registry/generator-registry.js';
import type { ConfigurationSnapshot } from '../../generator/context/configuration-snapshot.js';
import type { ToolContribution } from '../domain/contracts.js';

/**
 * AGENT-013 — Generator tools. Agents must not write generated artifacts
 * themselves; they request plan/run/preview via tools and apply through the
 * governed Generator platform (Generate ≠ Write survives automation).
 *
 * `generator.apply` is risk "control": it always requires approval.
 */
export function generatorToolContributions(
  registry: GeneratorRegistry,
  generation: GenerationService,
  snapshot: ConfigurationSnapshot,
): readonly ToolContribution[] {
  const inputSchema = {
    type: 'object',
    properties: {
      generatorId: { type: 'string' },
      input: { type: 'object' },
    },
    required: ['generatorId'],
    additionalProperties: false,
  };

  const buildInput = <T>(input: unknown): RunGenerationInput<T> => {
    const { generatorId } = input as { generatorId: string };
    const payload = (input as { input?: T }).input;
    return {
      generatorId,
      input: payload ?? ({} as T),
      configuration: snapshot,
    };
  };

  return [
    {
      toolId: 'generator.list',
      version: '1',
      description: 'List available generators and their capabilities',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      outputSchema: { type: 'object' },
      capabilities: ['generator.read'],
      risk: 'read',
      handler: async () => ({
        generators: registry.list().map((g) => ({ id: g.id, version: g.version, capabilities: g.capabilities })),
      }),
    },
    {
      toolId: 'generator.plan',
      version: '1',
      description: 'Plan a generation (plan + context, no output written)',
      inputSchema,
      outputSchema: { type: 'object' },
      capabilities: ['generator.plan'],
      risk: 'read',
      handler: async (_ctx, input) => {
        const planned = await generation.plan(buildInput(input));
        return {
          steps: planned.plan.steps.map((s) => ({ id: s.id, kind: s.kind, description: s.description })),
        };
      },
    },
    {
      toolId: 'generator.run',
      version: '1',
      description: 'Run a generator to produce an artifact set (no apply)',
      inputSchema,
      outputSchema: { type: 'object' },
      capabilities: ['generator.run'],
      risk: 'write',
      handler: async (_ctx, input) => {
        const result = await generation.run(buildInput(input));
        return {
          artifacts: result.artifacts?.all().map((f) => ({ path: f.path, kind: f.encoding })) ?? [],
          evidence: result.evidence,
        };
      },
    },
    {
      toolId: 'generator.preview',
      version: '1',
      description: 'Preview a generation against a target directory (diff)',
      inputSchema,
      outputSchema: { type: 'object' },
      capabilities: ['generator.preview'],
      risk: 'read',
      handler: async (_ctx, input) => {
        const runInput = buildInput(input);
        const result = await generation.run(runInput);
        const preview = await generation.preview({
          input: runInput,
          targetReader: {
            read: async (path) => {
              const artifact = result.artifacts?.all().find((a) => a.path === path);
              return artifact?.content ?? null;
            },
            exists: async (path) => result.artifacts?.has(path) ?? false,
          },
          previewHash: result.evidence.evidenceHash,
        });
        return {
          totalFiles: preview.totalFiles,
          additions: preview.additions,
          removals: preview.removals,
          changes: preview.changes,
          diff: preview.diff.map((d) => ({ path: d.path, operation: d.operation, added: d.addedLines, removed: d.removedLines })),
        };
      },
    },
    {
      toolId: 'generator.apply',
      version: '1',
      description: 'Apply a generation through the governed apply pipeline (requires approval)',
      inputSchema,
      outputSchema: { type: 'object' },
      capabilities: ['generator.apply'],
      risk: 'control',
      handler: async (_ctx, input) => {
        const result = await generation.run(buildInput(input));
        return { artifacts: result.artifacts?.all().length ?? 0, evidence: result.evidence };
      },
    },
  ];
}
