import { describe, expect, it } from 'vitest';
import {
  CodingAgentRuntimeRegistry,
  RuntimeSelector,
  ToolGateway,
  MemoryCodingAdapter,
  VestaraCodingAdapter,
  OpenCodeAdapter,
  type AgentRuntimePolicy,
} from '../../src/car/index.js';
import { AgentRegistry, BUILTIN_AGENTS, AgentRunStateMachine, AgentRuntime, ApprovalRuntime } from '../../src/agent/index.js';
import { SkillRegistry } from '../../src/skill/index.js';
import { ToolRegistry, ToolRuntime, ToolPolicy } from '../../src/tool/index.js';
import { AiModelCatalog, AiProviderRegistry, AiService, ModelRouter, type AiModel, type AiProviderAdapter } from '../../src/ai/index.js';
import { defineBuiltinSkills } from '../../src/bootstrap/skills.js';

const STUB_MODEL: AiModel = {
  id: 'stub', providerId: 'stub', name: 'S',
  capabilities: { reasoning: true, tools: true, structuredOutput: true, functionCalling: true, vision: false, embeddings: false, streaming: true },
  modalities: ['text'], contextWindow: 100000, openWeight: false, lifecycleStatus: 'ga',
};

function buildStack() {
  const registry = new AiProviderRegistry();
  const adapter: AiProviderAdapter = {
    providerId: 'stub', supports: () => true,
    generate: async () => ({ content: 'work', usage: { inputTokens: 1, outputTokens: 1 } }),
    stream: async function* () {},
  };
  registry.register({ provider: { id: 'stub', name: 'S', type: 'native', enabled: true, priority: 1 }, adapter });
  const catalog = new AiModelCatalog({ models: [STUB_MODEL] });
  const router = new ModelRouter(catalog, registry, { defaultProfile: 'auto', enabledProviders: [] });
  const ai = new AiService({ router, catalog, providers: registry });

  const tools = new ToolRegistry();
  tools.registerContribution({
    toolId: 'file.read', version: '1', description: 'r', inputSchema: {}, outputSchema: {},
    capabilities: ['file.read'], risk: 'read',
    handler: async () => ({ lines: 1 }),
  });
  tools.registerContribution({
    toolId: 'generator.apply', version: '1', description: 'a', inputSchema: {}, outputSchema: {},
    capabilities: ['generator.apply'], risk: 'control',
    handler: async () => ({ applied: true }),
  });
  const toolRuntime = new ToolRuntime({ registry: tools, policy: new ToolPolicy({ autoApproveRisks: ['read', 'write'] }) });

  const agents = new AgentRegistry();
  for (const a of BUILTIN_AGENTS) agents.register(a);
  const skills = new SkillRegistry();
  for (const s of defineBuiltinSkills()) skills.register(s);
  const runs = new AgentRunStateMachine();
  const runtime = new AgentRuntime({ agents, runs, tools: toolRuntime, skills, ai });
  const approvals = new ApprovalRuntime({ agents: runtime, runs, tools: toolRuntime });

  return { tools, toolRuntime, runtime, approvals, runs };
}

describe('CAR-002 registry + native adapter', () => {
  it('registers the native Vestara runtime and OpenCode', () => {
    const { runtime } = buildStack();
    const registry = new CodingAgentRuntimeRegistry();
    registry.register(new VestaraCodingAdapter(runtime));
    registry.register(new OpenCodeAdapter());
    expect(registry.has('vestara')).toBe(true);
    expect(registry.has('opencode')).toBe(true);
    expect(registry.list().length).toBe(2);
  });
});

describe('CAR-005/006/007 selection + fallback', () => {
  it('selects the native runtime for explicit vestara', async () => {
    const registry = new CodingAgentRuntimeRegistry();
    registry.register(new MemoryCodingAdapter('vestara'));
    registry.register(new MemoryCodingAdapter('codex'));
    const selector = new RuntimeSelector(registry, { preference: ['codex', 'opencode'] });
    const selected = await selector.select({ runtime: 'vestara' });
    expect(selected.runtimeId).toBe('vestara');
    expect(selected.viaFallback).toBe(false);
  });

  it('auto-selects a runtime matching the requirements', async () => {
    const registry = new CodingAgentRuntimeRegistry();
    registry.register(new MemoryCodingAdapter('vestara', { capabilities: { shell: false, filesystem: false } }));
    registry.register(new MemoryCodingAdapter('opencode', { capabilities: { shell: true, repositoryContext: true } }));
    const selector = new RuntimeSelector(registry, { preference: ['opencode', 'codex'] });
    const policy: AgentRuntimePolicy = { runtime: 'auto', requirements: { terminal: true, repositoryEditing: true } };
    const selected = await selector.select(policy);
    expect(selected.runtimeId).toBe('opencode');
    expect(selected.capabilities.shell).toBe(true);
  });

  it('falls back to the native runtime when no external runtime matches', async () => {
    const registry = new CodingAgentRuntimeRegistry();
    registry.register(new MemoryCodingAdapter('vestara'));
    registry.register(new MemoryCodingAdapter('codex', { capabilities: { shell: false } }));
    const selector = new RuntimeSelector(registry, { preference: ['codex'] });
    const selected = await selector.select({ runtime: 'auto', requirements: { terminal: true } });
    expect(selected.runtimeId).toBe('vestara');
    expect(selected.viaFallback).toBe(true);
  });

  it('reports health', async () => {
    const registry = new CodingAgentRuntimeRegistry();
    registry.register(new MemoryCodingAdapter('vestara'));
    const selector = new RuntimeSelector(registry);
    const health = await selector.health();
    expect(health[0]!.healthy).toBe(true);
  });
});

describe('CAR-008/009 tool gateway (Vestara-owned governance)', () => {
  it('auto-approves read tools and executes them', async () => {
    const { toolRuntime, approvals, runs } = buildStack();
    const gateway = new ToolGateway({ tools: toolRuntime, approvals });
    const result = await gateway.execute({ runtimeId: 'opencode', sessionId: 's1', agentId: 'vestara-developer', toolId: 'file.read', input: {} });
    expect(result.ok).toBe(true);
    expect(result.approvalRequired).toBe(false);
  });

  it('returns approval-required for control tools without approval', async () => {
    const { toolRuntime, approvals } = buildStack();
    const gateway = new ToolGateway({ tools: toolRuntime, approvals });
    const result = await gateway.execute({ runtimeId: 'opencode', sessionId: 's1', agentId: 'vestara-developer', toolId: 'generator.apply', input: {} });
    expect(result.ok).toBe(false);
    expect(result.approvalRequired).toBe(true);
  });
});

describe('CAR-011 OpenCode adapter', () => {
  it('declares full capabilities and degrades to native planning', async () => {
    const adapter = new OpenCodeAdapter();
    const caps = await adapter.capabilities();
    expect(caps.sessions).toBe(true);
    expect(caps.resumableSessions).toBe(true);
    expect(caps.tools).toBe(true);

    const session = await adapter.createSession({ agentId: 'vestara-developer', runId: 'r1' });
    expect(session.runtimeId).toBe('opencode');
    const events: string[] = [];
    for await (const event of adapter.execute(session, { prompt: 'do it' })) {
      events.push(event.type);
    }
    expect(events).toContain('completed');
  });
});
