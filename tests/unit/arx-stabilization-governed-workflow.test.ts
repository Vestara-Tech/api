import { describe, expect, it, vi } from 'vitest';
import { GovernedActivityRunner, type GovernedActivityRunnerDeps } from '../../src/activity-room/runtime/governed-runner.js';
import { ExecutionServiceImpl } from '../../src/execution/service.js';
import { InMemoryExecutionStore } from '../../src/execution/store.js';
import { CapabilityRegistry } from '../../src/capabilities/registry.js';
import { InMemoryActivityHistoryStore } from '../../src/activity-room/history/store.js';
import { ActivityHistoryRecorderImpl } from '../../src/activity-room/history/recorder.js';
import { AgentRegistry } from '../../src/agent/registry/agent-registry.js';
import { BUILTIN_AGENTS } from '../../src/agent/registry/builtin-agents.js';
import { RuntimeSelector } from '../../src/car/runtime/runtime-selector.js';
import { CodingAgentRuntimeRegistry } from '../../src/car/registry/coding-agent-runtime-registry.js';
import { OpenCodeAdapter } from '../../src/car/adapters/opencode-adapter.js';
import { VestaraCodingAdapter } from '../../src/car/adapters/vestara-coding-adapter.js';
import { DeveloperExecutionCoordinator } from '../../src/car/runtime/developer-execution-coordinator.js';
import { InMemoryRuntimeSessionRegistry } from '../../src/car/runtime/runtime-session-registry.js';
import { WorkflowService } from '../../src/workflow/service/workflow-service.js';
import { WorkflowRuntime } from '../../src/workflow/runtime/workflow-runtime.js';
import { WorkflowRegistry } from '../../src/workflow/registry/workflow-registry.js';
import { AgentRuntime } from '../../src/agent/runtime/agent-runtime.js';
import { AgentRunStateMachine } from '../../src/agent/runtime/run-state-machine.js';
import { SkillRegistry } from '../../src/skill/index.js';
import { ToolRegistry, ToolRuntime, ToolPolicy } from '../../src/tool/index.js';
import { AiModelCatalog, AiProviderRegistry, AiService, ModelRouter, type AiModel, type AiProviderAdapter } from '../../src/ai/index.js';
import { defineBuiltinSkills } from '../../src/bootstrap/skills.js';
import type { AgentRuntime as AgentRuntimeType } from '../../src/agent/runtime/agent-runtime.js';
import type { WorkflowService as WorkflowServiceType } from '../../src/workflow/service/workflow-service.js';
import type { VerificationControlPlane } from '../../src/verification/domain/contracts.js';

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

function makeRegistry(agents: AgentRegistry): CodingAgentRuntimeRegistry {
  const registry = new CodingAgentRuntimeRegistry();
  registry.register(new VestaraCodingAdapter({} as unknown as AgentRuntimeType));
  registry.register(new OpenCodeAdapter({ mode: 'external', baseUrl: 'http://127.0.0.1:4096', defaultProvider: 'opencode', defaultModel: 'opencode/test-model' }));
  return registry;
}

function makeWorkflowService(): WorkflowService {
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
  return new WorkflowService({
    registry,
    runtime: new WorkflowRuntime({ registry, agents: runtime, tools: toolRuntime }),
  });
}

interface HarnessOptions {
  readonly workflow?: WorkflowServiceType;
  readonly store?: InMemoryActivityHistoryStore;
}

interface Harness {
  runner: GovernedActivityRunner;
  store: InMemoryActivityHistoryStore;
  workflow: WorkflowService;
  executeSpy: ReturnType<typeof vi.spyOn>;
}

function makeHarness(options: HarnessOptions = {}): Harness {
  const capabilities = new CapabilityRegistry();
  const agents = new AgentRegistry();
  for (const agent of BUILTIN_AGENTS) agents.register(agent);

  const execution = new ExecutionServiceImpl({
    capabilities,
    agents,
    store: new InMemoryExecutionStore(),
  });

  const store = options.store ?? new InMemoryActivityHistoryStore();
  const recorder = new ActivityHistoryRecorderImpl(store);

  const registry = makeRegistry(agents);
  const selector = new RuntimeSelector(registry);

  const coordinator = new DeveloperExecutionCoordinator({
    agents,
    skillRegistry: { get: () => { throw new Error('not used'); }, list: () => [] } as never,
    skillResolver: { composeInstructions: () => '' } as never,
    verification: {} as VerificationControlPlane,
    sessions: new InMemoryRuntimeSessionRegistry({ maxActiveSessions: 2, maxSessionsPerExecution: 1, sessionIdleTimeoutMs: 60_000, maxFixAttempts: 1 }),
  });

  const executeSpy = vi.spyOn(coordinator, 'execute');
  const workflow = options.workflow ?? makeWorkflowService();

  const deps: GovernedActivityRunnerDeps = {
    execution,
    recorder,
    history: store,
    workflow,
    agents,
    selector,
    registry,
    coordinator,
    evidence: { save: vi.fn().mockResolvedValue(undefined), get: vi.fn().mockResolvedValue(null) },
  };

  const runner = new GovernedActivityRunner(deps);
  return { runner, store, workflow, executeSpy };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('ARX-STAB-003 governed workflow routing', () => {
  it('starts exactly one workflow run per COMPLEX start', async () => {
    const { runner, workflow } = makeHarness();

    const result = await runner.start({ goal: 'Build the Theme Builder', principalId: 'console-user' });

    expect(result.route).toBe('workflow');
    expect(result.complexity).toBe('complex');
    expect(result.workflowId).toBe('vestara-governed-complex');
    expect(result.workflowRunId).toEqual(expect.any(String));

    const runs = workflow.listRuns();
    expect(runs.length).toBe(1);
    expect(runs[0]?.id).toBe(result.workflowRunId);
    expect(runs[0]?.workflowId).toBe('vestara-governed-complex');
  });

  it('activates the Planner first, gating the Developer behind planning', async () => {
    const { runner, store } = makeHarness();

    const result = await runner.start({ goal: 'Build the Theme Builder', principalId: 'console-user' });

    const fact = store.getExecution(result.executionId);
    expect(fact?.participants[0]?.role).toBe('planner');
    expect(fact?.participants[0]?.agentId).toBe('vestara-planner');
    expect(fact?.participants[0]?.status).toBe('active');
    expect(fact?.status).toBe('running');
  });

  it('gates the Developer step behind planning in the governed definition', async () => {
    const { workflow, runner, executeSpy } = makeHarness();

    // Starting a run registers the governed definition (idempotent).
    await runner.start({ goal: 'Build the Theme Builder', principalId: 'console-user' });

    const complex = workflow.get('vestara-governed-complex');
    const planStep = complex.steps.find((s) => s.id === 'plan');
    const decomposeStep = complex.steps.find((s) => s.id === 'decompose');
    const buildStep = complex.steps.find((s) => s.id === 'build');
    const reviewStep = complex.steps.find((s) => s.id === 'review');
    const verifyStep = complex.steps.find((s) => s.id === 'verify');

    expect(planStep?.kind).toBe('agent');
    expect(planStep?.agent?.agentId).toBe('vestara-planner');
    expect(planStep?.dependsOn).toBeUndefined();
    expect(decomposeStep?.dependsOn).toEqual(['plan']);
    expect(buildStep?.dependsOn).toEqual(['decompose']);
    expect(reviewStep?.dependsOn).toEqual(['build']);
    expect(verifyStep?.dependsOn).toEqual(['review']);

    // The Planner step appears before the Developer step in dispatch order.
    const complexIndexes = complex.steps.map((s) => s.id);
    expect(complexIndexes.indexOf('plan')).toBeLessThan(complexIndexes.indexOf('build'));

    // The Developer coordinator is never launched for COMPLEX.
    await sleep(20);
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('persists the correlation durably and reuses it across a restarted runtime', async () => {
    const store = new InMemoryActivityHistoryStore();
    const { runner, workflow } = makeHarness({ store });

    const first = await runner.start({ goal: 'Build the Theme Builder', principalId: 'console-user' });
    expect(first.workflowRunId).toBeDefined();

    // Simulate a process restart: new runner over the same durable store but a
    // fresh (empty) workflow runtime. The correlation must be authoritative and
    // no second workflow run may be created.
    const restarted = makeHarness({ store });
    const result = await restarted.runner.start({ goal: 'Build the Theme Builder', principalId: 'console-user' });
    expect(result.executionId).toBe(first.executionId);
    expect(result.workflowRunId).toBe(first.workflowRunId);

    const runs = restarted.workflow.listRuns();
    expect(runs.length).toBe(0);
    void workflow;
  });

  it('a retried start does not create a duplicate workflow run', async () => {
    const { runner, workflow, store } = makeHarness();

    const first = await runner.start({ goal: 'Build the Theme Builder', principalId: 'console-user' });
    const second = await runner.start({ goal: 'Build the Theme Builder', principalId: 'console-user' });

    expect(second.executionId).toBe(first.executionId);
    expect(second.workflowRunId).toBe(first.workflowRunId);
    expect(workflow.listRuns().filter((run) => run.id === first.workflowRunId).length).toBe(1);
    expect(store.listExecutions('activity-room').length).toBe(1);
  });

  it('a workflow-start failure moves the execution to failed and records a durable workflow-failed event', async () => {
    const failing = makeWorkflowService();
    const failingSpy = vi.spyOn(failing, 'startGoverned').mockImplementation(() => {
      throw new Error('governed workflow unavailable');
    });
    const { runner, store, executeSpy } = makeHarness({ workflow: failing });

    const result = await runner.start({ goal: 'Build the Theme Builder', principalId: 'console-user' });

    expect(result.route).toBe('workflow');
    expect(result.status).toBe('failed');
    expect(failingSpy).toHaveBeenCalled();

    const fact = store.getExecution(result.executionId);
    expect(fact?.status).toBe('failed');
    expect(fact?.workflowRunId).toBe('');

    const events = store.events(result.executionId);
    expect(events.some((e) => e.type === 'workflow-failed')).toBe(true);
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('emits durable workflow-started + workflow-progressed events with the correlation', async () => {
    const { runner, store } = makeHarness();

    const result = await runner.start({ goal: 'Build the Theme Builder', principalId: 'console-user' });

    const events = store.events(result.executionId);
    const started = events.filter((e) => e.type === 'workflow-started');
    const progressed = events.filter((e) => e.type === 'workflow-progressed');

    expect(started.length).toBe(1);
    expect(started[0]?.payload).toMatchObject({
      workflowId: 'vestara-governed-complex',
      workflowRunId: result.workflowRunId,
    });
    expect(progressed.length).toBeGreaterThanOrEqual(1);
    expect(progressed[0]?.payload).toMatchObject({
      stepId: 'plan',
      role: 'planner',
      workflowRunId: result.workflowRunId,
    });
  });

  it('keeps SIMPLE goals on the DEX developer route', async () => {
    const { runner, executeSpy } = makeHarness();

    const result = await runner.start({ goal: 'Generate a TypeScript script', principalId: 'console-user' });

    expect(result.route).toBe('developer');
    expect(result.complexity).toBe('simple');
    expect(result.status).toBe('running');
    expect(result.workflowRunId).toBeUndefined();

    await vi.waitFor(() => {
      expect(executeSpy).toHaveBeenCalled();
    });
  });

  it('routes STANDARD through its own Planner→Developer→Verifier definition, not the COMPLEX pipeline', async () => {
    const { workflow, runner } = makeHarness();

    // Starting runs registers both governed definitions (idempotent).
    await runner.start({ goal: 'Build the Theme Builder', principalId: 'console-user' });
    await runner.start({ goal: 'Fix the login flow', principalId: 'console-user' });

    const standard = workflow.get('vestara-governed-standard');
    expect(standard.id).toBe('vestara-governed-standard');
    expect(standard.steps.map((s) => s.id)).toEqual(['plan', 'build', 'verify']);

    const standardPlan = standard.steps.find((s) => s.id === 'plan');
    const standardBuild = standard.steps.find((s) => s.id === 'build');
    const standardVerify = standard.steps.find((s) => s.id === 'verify');
    expect(standardPlan?.agent?.agentId).toBe('vestara-planner');
    expect(standardBuild?.agent?.agentId).toBe('vestara-developer');
    expect(standardBuild?.dependsOn).toEqual(['plan']);
    expect(standardVerify?.agent?.agentId).toBe('vestara-verifier');
    expect(standardVerify?.dependsOn).toEqual(['build']);

    // STANDARD uses the distinct standard workflow, not the COMPLEX one.
    const complex = workflow.get('vestara-governed-complex');
    expect(standard.id).not.toBe(complex.id);
    expect(standard.steps.length).toBe(3);
    expect(complex.steps.length).toBe(5);
  });
});
