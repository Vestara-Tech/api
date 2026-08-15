import { describe, expect, it } from 'vitest';
import {
  WorkflowGraph,
  WorkflowRegistry,
  WorkflowRuntime,
  WorkflowService,
  evaluateExpression,
  type WorkflowDefinition,
  type WorkflowStepDefinition,
} from '../../src/workflow/index.js';
import { AgentRegistry, BUILTIN_AGENTS, AgentRunStateMachine, AgentRuntime } from '../../src/agent/index.js';
import { SkillRegistry } from '../../src/skill/index.js';
import { ToolRegistry, ToolRuntime, ToolPolicy } from '../../src/tool/index.js';
import { AiModelCatalog, AiProviderRegistry, AiService, ModelRouter, type AiModel, type AiProviderAdapter } from '../../src/ai/index.js';
import { defineBuiltinSkills } from '../../src/bootstrap/skills.js';

const STUB_MODEL: AiModel = {
  id: 'stub', providerId: 'stub', name: 'S',
  capabilities: { reasoning: true, tools: true, structuredOutput: true, functionCalling: true, vision: false, embeddings: false, streaming: true },
  modalities: ['text'], contextWindow: 100000, openWeight: false, lifecycleStatus: 'ga',
};

function stubAi(): AiService {
  const registry = new AiProviderRegistry();
  const adapter: AiProviderAdapter = {
    providerId: 'stub', supports: () => true,
    generate: async () => ({ content: 'work', usage: { inputTokens: 1, outputTokens: 1 } }),
    stream: async function* () {},
  };
  registry.register({ provider: { id: 'stub', name: 'S', type: 'native', enabled: true, priority: 1 }, adapter });
  const catalog = new AiModelCatalog({ models: [STUB_MODEL] });
  const router = new ModelRouter(catalog, registry, { defaultProfile: 'auto', enabledProviders: [] });
  return new AiService({ router, catalog, providers: registry });
}

function buildService() {
  const tools = new ToolRegistry();
  tools.registerContribution({
    toolId: 'filesystem.read', version: '1', description: 'read', inputSchema: {}, outputSchema: {},
    capabilities: ['filesystem.read'], risk: 'read',
    handler: async () => ({ lines: 10 }),
  });
  tools.registerContribution({
    toolId: 'generator.run', version: '1', description: 'run', inputSchema: {}, outputSchema: {},
    capabilities: ['generator.run'], risk: 'write',
    handler: async () => ({ artifacts: 3 }),
  });
  tools.registerContribution({
    toolId: 'generator.apply', version: '1', description: 'apply', inputSchema: {}, outputSchema: {},
    capabilities: ['generator.apply'], risk: 'control',
    handler: async () => ({ applied: true }),
  });
  const toolRuntime = new ToolRuntime({ registry: tools, policy: new ToolPolicy({ autoApproveRisks: ['read', 'write'] }) });

  const agents = new AgentRegistry();
  for (const a of BUILTIN_AGENTS) agents.register(a);
  const skills = new SkillRegistry();
  for (const s of defineBuiltinSkills()) skills.register(s);
  const runs = new AgentRunStateMachine();
  const runtime = new AgentRuntime({ agents, runs, tools: toolRuntime, skills, ai: stubAi() });

  const registry = new WorkflowRegistry();
  const service = new WorkflowService({
    registry,
    runtime: new WorkflowRuntime({ registry, agents: runtime, tools: toolRuntime }),
  });
  return { service, toolRuntime, runtime, registry };
}

function makeWorkflow(overrides: { steps?: readonly WorkflowStepDefinition[] } = {}): Parameters<WorkflowService['create']>[0] {
  return {
    id: 'feature-workflow',
    name: 'Feature Workflow',
    version: '1.0.0',
    inputs: [{ name: 'feature', type: 'string', required: true }],
    steps: overrides.steps ?? [
      { id: 'plan', kind: 'agent', name: 'Plan', agent: { agentId: 'vestara-planner', objective: 'Plan {{feature}}' } },
      { id: 'implement', kind: 'agent', name: 'Implement', dependsOn: ['plan'], agent: { agentId: 'vestara-developer', objective: 'Implement {{feature}}' } },
      { id: 'verify', kind: 'verification', name: 'Verify', dependsOn: ['implement'], verification: { requirements: ['{{implement}} != ""'], requireEvidence: true } },
    ],
  };
}

describe('WF-003 graph model', () => {
  it('computes a topological order for a valid DAG', () => {
    const definition: WorkflowDefinition = { ...makeWorkflow(), status: 'draft', revision: 0 };
    const graph = new WorkflowGraph(definition);
    const validation = graph.validate();
    expect(validation.ok).toBe(true);
    expect(validation.order).toEqual(['plan', 'implement', 'verify']);
  });

  it('rejects cycles', () => {
    const definition: WorkflowDefinition = {
      ...makeWorkflow(),
      status: 'draft',
      revision: 0,
      steps: [
        { id: 'a', kind: 'service', name: 'A', dependsOn: ['b'], service: { service: 'x', operation: 'y' } },
        { id: 'b', kind: 'service', name: 'B', dependsOn: ['a'], service: { service: 'x', operation: 'y' } },
      ],
    };
    const graph = new WorkflowGraph(definition);
    const validation = graph.validate();
    expect(validation.ok).toBe(false);
    expect(validation.issues.some((i) => i.message.includes('cycle'))).toBe(true);
  });

  it('rejects unknown dependencies', () => {
    const definition: WorkflowDefinition = {
      ...makeWorkflow(),
      status: 'draft',
      revision: 0,
      steps: [{ id: 'a', kind: 'service', name: 'A', dependsOn: ['nope'], service: { service: 'x', operation: 'y' } }],
    };
    const graph = new WorkflowGraph(definition);
    expect(graph.validate().ok).toBe(false);
  });
});

describe('WF-001 registry validation', () => {
  it('registers only valid DAGs', () => {
    const service = buildService().service;
    const def = service.create(makeWorkflow());
    expect(def.status).toBe('draft');
    expect(() =>
      service.create({
        ...makeWorkflow(),
        id: 'broken',
        steps: [
          { id: 'a', kind: 'service', name: 'A', dependsOn: ['b'], service: { service: 'x', operation: 'y' } },
          { id: 'b', kind: 'service', name: 'B', dependsOn: ['a'], service: { service: 'x', operation: 'y' } },
        ],
      }),
    ).toThrow(/cycle/);
  });
});

describe('WF-005 runtime execution', () => {
  it('executes a workflow to completion in dependency order', async () => {
    const { service } = buildService();
    service.create(makeWorkflow());
    service.publish('feature-workflow');
    const run = service.start('feature-workflow', { feature: 'orders API' });
    await waitFor(() => service.getRun(run.id).status === 'completed');
    const final = service.getRun(run.id);
    expect(final.status).toBe('completed');
    const statuses = final.steps.map((s) => s.status);
    expect(statuses).toEqual(['completed', 'completed', 'completed']);
    // Plan must finish before implement (dependency order in context).
    expect(final.steps[0]!.completedAt! <= final.steps[1]!.completedAt!).toBe(true);
  });

  it('executes tool steps and verification steps', async () => {
    const { service } = buildService();
    service.create({
      id: 'tool-flow',
      name: 'Tool Flow',
      version: '1.0.0',
      steps: [
        { id: 'read', kind: 'tool', name: 'Read', tool: { toolId: 'filesystem.read' } },
        { id: 'gen', kind: 'tool', name: 'Generate', dependsOn: ['read'], tool: { toolId: 'generator.run' } },
        { id: 'check', kind: 'verification', name: 'Check', dependsOn: ['gen'], verification: { requirements: ['{{gen}} != ""'], requireEvidence: true } },
      ],
    });
    service.publish('tool-flow');
    const run = service.start('tool-flow');
    await waitFor(() => service.getRun(run.id).status === 'completed');
    expect(service.getRun(run.id).steps.every((s) => s.status === 'completed')).toBe(true);
  });

  it('suspends waiting for approval on approval gates and control tools', async () => {
    const { service } = buildService();
    service.create({
      id: 'approve-flow',
      name: 'Approve Flow',
      version: '1.0.0',
      steps: [
        { id: 'apply', kind: 'tool', name: 'Apply', tool: { toolId: 'generator.apply', requiresApproval: true } },
      ],
    });
    service.publish('approve-flow');
    const run = service.start('approve-flow');
    await waitFor(() => service.getRun(run.id).status === 'waiting');
    const final = service.getRun(run.id);
    expect(final.status).toBe('waiting');
    expect(final.waitingOnStep).toBe('apply');
  });
});

describe('WF-008 conditions + expressions', () => {
  it('evaluates context expressions', () => {
    expect(evaluateExpression('{{feature}} == "orders"', { feature: 'orders' })).toBe(true);
    expect(evaluateExpression('{{count}} > 3', { count: 5 })).toBe(true);
    expect(evaluateExpression('{{count}} > 3', { count: 1 })).toBe(false);
  });

  it('skips steps whose skipIf condition holds', async () => {
    const { service } = buildService();
    service.create({
      id: 'skip-flow',
      name: 'Skip Flow',
      version: '1.0.0',
      inputs: [{ name: 'skip', type: 'boolean', required: false, default: true }],
      steps: [
        { id: 'read', kind: 'tool', name: 'Read', tool: { toolId: 'filesystem.read' }, skipIf: '{{skip}} == true' },
      ],
    });
    service.publish('skip-flow');
    const run = service.start('skip-flow', { skip: true });
    await waitFor(() => service.getRun(run.id).status === 'completed');
    expect(service.getRun(run.id).steps[0]!.status).toBe('skipped');
  });
});

describe('WF-010 failure policy', () => {
  it('fails the workflow when a step fails', async () => {
    const { service, toolRuntime } = buildService();
    const { ToolRegistry, ToolPolicy } = await import('../../src/tool/index.js');
    const badRegistry = new ToolRegistry();
    badRegistry.registerContribution({
      toolId: 'boom', version: '1', description: 'boom', inputSchema: {}, outputSchema: {},
      capabilities: ['boom'], risk: 'write',
      handler: async () => { throw new Error('exploded'); },
    });
    const badRuntime = new ToolRuntime({ registry: badRegistry, policy: new ToolPolicy({ autoApproveRisks: ['read', 'write'] }) });
    // Build a fresh service with a failing tool.
    const agents = buildService().runtime;
    const failRegistry = new WorkflowRegistry();
    const srv = new WorkflowService({ registry: failRegistry, runtime: new WorkflowRuntime({ registry: failRegistry, agents, tools: badRuntime }) });
    srv.create({
      id: 'fail-flow',
      name: 'Fail Flow',
      version: '1.0.0',
      steps: [{ id: 'boom', kind: 'tool', name: 'Boom', tool: { toolId: 'boom' } }],
    });
    srv.publish('fail-flow');
    const run = srv.start('fail-flow');
    await waitFor(() => srv.getRun(run.id).status === 'failed');
    expect(srv.getRun(run.id).steps[0]!.error).toContain('exploded');
  });
});

describe('WF-011 parallelism', () => {
  it('runs parallel branches and fans in', async () => {
    const { service } = buildService();
    service.create({
      id: 'parallel-flow',
      name: 'Parallel Flow',
      version: '1.0.0',
      steps: [
        {
          id: 'fanout',
          kind: 'parallel',
          name: 'Fan-out',
          parallel: {
            branches: [
              { id: 'read', kind: 'tool', name: 'Read', tool: { toolId: 'filesystem.read' } },
              { id: 'gen', kind: 'tool', name: 'Generate', tool: { toolId: 'generator.run' } },
            ],
          },
        },
      ],
    });
    service.publish('parallel-flow');
    const run = service.start('parallel-flow');
    await waitFor(() => service.getRun(run.id).status === 'completed');
    expect(service.getRun(run.id).status).toBe('completed');
  });
});

describe('WF-001 publish + revisions', () => {
  it('publishes and records a revision', () => {
    const { service } = buildService();
    service.create(makeWorkflow());
    const published = service.publish('feature-workflow');
    expect(published.status).toBe('published');
    expect(published.revision).toBe(1);
    expect(service.get('feature-workflow').revision).toBe(1);
  });
});

async function waitFor(cond: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 10));
  }
}
