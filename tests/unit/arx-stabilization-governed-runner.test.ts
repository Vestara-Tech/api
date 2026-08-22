/**
 * ARX-014 — Governed Activity Room runner regression.
 *
 * Proves the Activity Room's primary action routes through the
 * DEX/complexity boundary and NEVER through the legacy AI model-selection
 * path:
 *
 *   SIMPLE/STANDARD → DeveloperExecutionCoordinator via a CAR-selected
 *                     runtime (OpenCode adapter).
 *   COMPLEX          → planning/workflow path; the developer coordinator is
 *                     NOT launched.
 *
 * The runner has no AI platform dependency by construction, so an Activity
 * Room goal can never invoke `AiService`/`ModelRouter` model resolution.
 */
import { describe, expect, it, vi } from 'vitest';
import { GovernedActivityRunner } from '../../src/activity-room/runtime/governed-runner.js';
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
import type { ApprovalRuntime } from '../../src/agent/approval/approval-runtime.js';
import type { ToolRuntime as ToolRuntimeType } from '../../src/tool/runtime/tool-runtime.js';
import type { VerificationControlPlane } from '../../src/verification/domain/contracts.js';

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

function makeRunner() {
  const capabilities = new CapabilityRegistry();
  const agents = new AgentRegistry();
  for (const agent of BUILTIN_AGENTS) agents.register(agent);

  const execution = new ExecutionServiceImpl({
    capabilities,
    agents,
    store: new InMemoryExecutionStore(),
  });

  const store = new InMemoryActivityHistoryStore();
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
  const workflow = makeWorkflowService();

  const runner = new GovernedActivityRunner({
    execution,
    recorder,
    history: store,
    workflow,
    agents,
    selector,
    registry,
    coordinator,
    evidence: { save: vi.fn().mockResolvedValue(undefined), get: vi.fn().mockResolvedValue(null) },
  });

  return { runner, execution, store, executeSpy, selector, workflow };
}

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

describe('GovernedActivityRunner (ARX-014)', () => {
  it('routes a SIMPLE goal to the developer route through a CAR-selected runtime', async () => {
    const { runner, store, executeSpy } = makeRunner();

    const result = await runner.start({ goal: 'Generate a TypeScript script', principalId: 'console-user' });

    expect(result.route).toBe('developer');
    expect(result.complexity).toBe('simple');
    expect(result.status).toBe('running');

    // The coordinator was invoked (fire-and-forget); a CAR runtime must be
    // selected. Wait for the background promise to settle.
    await vi.waitFor(() => {
      expect(executeSpy).toHaveBeenCalled();
    });

    // The adapter passed to the coordinator is the OpenCode adapter, selected
    // by the RuntimeSelector preference — never the AI model registry.
    const adapter = executeSpy.mock.calls[0]?.[1];
    expect(adapter?.id).toBe('opencode');

    // Execution recorded as a durable fact.
    const facts = store.listExecutions('activity-room');
    expect(facts.length).toBe(1);
    expect(facts[0]?.executionId).toBe(result.executionId);
  });

  it('routes a COMPLEX goal to a real workflow run with the Planner first, without launching the developer coordinator', async () => {
    const { runner, store, executeSpy, workflow } = makeRunner();

    const result = await runner.start({ goal: 'Build the Theme Builder', principalId: 'console-user' });

    expect(result.route).toBe('workflow');
    expect(result.complexity).toBe('complex');
    expect(result.status).toBe('running');
    expect(result.workflowRunId).toEqual(expect.any(String));
    expect(result.workflowId).toBe('vestara-governed-complex');

    // A real workflow run exists and is the only run.
    const runs = workflow.listRuns();
    expect(runs.length).toBe(1);
    expect(runs[0]?.id).toBe(result.workflowRunId);

    // The workflow begins with the Planner; the Developer step depends on
    // planning/decomposition and must not run first.
    const definition = workflow.get('vestara-governed-complex');
    const planStep = definition.steps.find((s) => s.id === 'plan');
    const decomposeStep = definition.steps.find((s) => s.id === 'decompose');
    const buildStep = definition.steps.find((s) => s.id === 'build');
    expect(planStep?.kind).toBe('agent');
    expect(planStep?.agent?.agentId).toBe('vestara-planner');
    expect(decomposeStep?.agent?.agentId).toBe('vestara-planner');
    expect(buildStep?.agent?.agentId).toBe('vestara-developer');
    expect(buildStep?.dependsOn).toEqual(['decompose']);
    expect(decomposeStep?.dependsOn).toEqual(['plan']);

    // The developer coordinator must NOT be launched for COMPLEX goals.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(executeSpy).not.toHaveBeenCalled();

    // Correlation persisted as a durable fact + workflow-started event.
    const facts = store.listExecutions('activity-room');
    expect(facts[0]?.workflowRunId).toBe(result.workflowRunId);
    const events = store.events(result.executionId);
    expect(events.some((e) => e.type === 'workflow-started')).toBe(true);
    expect(events.some((e) => e.type === 'workflow-progressed')).toBe(true);
  });

  it('never depends on the AI platform (no model selection in the governed path)', async () => {
    // The GovernedActivityRunner constructor takes no AI service/model router
    // dependency. Static assertion: the module must not import the AI runtime.
    const source = await import('node:fs').then(({ readFileSync }) =>
      readFileSync(new URL('../../src/activity-room/runtime/governed-runner.ts', import.meta.url), 'utf8'),
    );
    expect(source).not.toMatch(/ai\/runtime\/ai-runtime|ai\/runtime\/model-router|@opencode-ai\/sdk/);
    expect(source).toMatch(/DeveloperExecutionCoordinator/);
  });
});