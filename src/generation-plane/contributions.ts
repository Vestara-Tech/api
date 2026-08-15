import type { Generator, GenerationContext, GenerationOutcome } from '../generator/domain/contracts.js';
import { createGenerationPlan, type GenerationPlan } from '../generator/domain/plan.js';
import { ArtifactSet } from '../generator/artifacts/artifact-set.js';
import type { GeneratorContribution } from './contracts.js';

function artifactOnlyGenerator(id: string, produce: (input: unknown) => { path: string; content: string }[]): Generator {
  return {
    id,
    version: '1.0.0',
    capabilities: [],
    requiresSecrets: false,
    plan: async (input: unknown): Promise<GenerationPlan> =>
      createGenerationPlan({
        id: `plan-${id}`,
        generatorId: id,
        inputHash: String(JSON.stringify(input)),
        steps: [{ id: 'gen', kind: 'transform', description: 'produce artifacts' }],
        requirements: [],
      }),
    generate: async (input: unknown): Promise<GenerationOutcome<{ count: number }>> => {
      const artifacts = new ArtifactSet(id, '1.0.0');
      for (const { path, content } of produce(input)) {
        artifacts.add({ path, content });
      }
      return { artifacts, output: { count: artifacts.size() } };
    },
  };
}

function contribution(
  id: string,
  moduleId: string,
  category: GeneratorContribution['category'],
  capabilities: readonly string[],
  produce: (input: unknown) => { path: string; content: string }[],
): GeneratorContribution {
  return {
    id,
    moduleId,
    version: '1.0.0',
    category,
    capabilities,
    inputSchema: {},
    outputKinds: ['utf8'],
    permissions: [`${moduleId}.generate`],
    createGenerator: () => artifactOnlyGenerator(id, produce),
  };
}

/** GEN-X10 — built-in cross-module generator contributions. */
export function generationPlaneContributions(): readonly GeneratorContribution[] {
  return [
    contribution('api.resource', 'builder', 'api', ['api.resource'], (input) => {
      const name = (input as { name?: string }).name ?? 'Resource';
      return [{ path: `${name.toLowerCase()}.schema.json`, content: JSON.stringify({ name, fields: [] }, null, 2) }];
    }),
    contribution('agent.definition', 'agent', 'agent', ['agent.definition'], (input) => {
      const role = (input as { role?: string }).role ?? 'assistant';
      return [{ path: `agent.${role}.json`, content: JSON.stringify({ role, id: `vestara-${role}` }, null, 2) }];
    }),
    contribution('workflow.definition', 'workflow', 'workflow', ['workflow.definition'], (input) => {
      const name = (input as { name?: string }).name ?? 'workflow';
      return [{ path: `workflow.${name}.json`, content: JSON.stringify({ name, steps: [] }, null, 2) }];
    }),
    contribution('test.api', 'test', 'test', ['test.api'], (input) => {
      const resource = (input as { resource?: string }).resource ?? 'resource';
      const operations = (input as { operations?: readonly string[] }).operations ?? ['GET', 'POST'];
      return [{ path: `${resource}.test.ts`, content: `// tests for ${resource}: ${operations.join(', ')}` }];
    }),
  ];
}
