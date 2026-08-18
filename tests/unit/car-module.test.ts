import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CodingAgentRuntimeRegistry,
  RuntimeSelector,
  ToolGateway,
  MemoryCodingAdapter,
  VestaraCodingAdapter,
  OpenCodeAdapter,
  CodexAdapter,
  type AgentRuntimePolicy,
} from '../../src/car/index.js';
import { AgentRegistry, BUILTIN_AGENTS, AgentRunStateMachine, AgentRuntime, ApprovalRuntime } from '../../src/agent/index.js';
import { SkillRegistry } from '../../src/skill/index.js';
import { ToolRegistry, ToolRuntime, ToolPolicy } from '../../src/tool/index.js';
import { AiModelCatalog, AiProviderRegistry, AiService, ModelRouter, type AiModel, type AiProviderAdapter } from '../../src/ai/index.js';
import { defineBuiltinSkills } from '../../src/bootstrap/skills.js';

const sdkMocks = vi.hoisted(() => {
  const fields = <T,>(data: T) => ({ data, request: {} as Request, response: {} as Response });

  const opencodeSession = {
    id: 'opencode-session-1',
    projectID: 'project-1',
    directory: '/workspace',
    title: 'Implement feature',
    version: '1',
    time: { created: 1_700_000_000_000, updated: 1_700_000_000_000 },
  };
  const opencodePromptResponse = {
    info: {
      id: 'assistant-1',
      sessionID: opencodeSession.id,
      role: 'assistant',
      time: { created: 1_700_000_000_500, completed: 1_700_000_000_750 },
      parentID: 'user-1',
      modelID: 'claude-3-5-sonnet',
      providerID: 'anthropic',
      mode: 'build',
      path: { cwd: '/workspace', root: '/workspace' },
      cost: 0,
      tokens: {
        input: 12,
        output: 8,
        reasoning: 2,
        cache: { read: 1, write: 0 },
      },
    },
    parts: [
      {
        id: 'part-1',
        sessionID: opencodeSession.id,
        messageID: 'assistant-1',
        type: 'text',
        text: 'OpenCode result',
      },
    ],
  };
  const opencodeClient = {
    session: {
      create: vi.fn(async () => fields(opencodeSession)),
      get: vi.fn(async () => fields(opencodeSession)),
      prompt: vi.fn(async () => fields(opencodePromptResponse)),
      abort: vi.fn(async () => fields(true)),
      delete: vi.fn(async () => fields(true)),
    },
  };
  const opencodeServer = { close: vi.fn() };
  const opencodeCreate = vi.fn(async () => ({ client: opencodeClient, server: opencodeServer }));
  const opencodeCreateClient = vi.fn(() => opencodeClient);

  const codexTurn = {
    items: [
      {
        id: 'reasoning-1',
        type: 'reasoning',
        text: 'Planning the fix',
      },
      {
        id: 'command-1',
        type: 'command_execution',
        command: 'pnpm test',
        aggregated_output: 'tests passed',
        exit_code: 0,
        status: 'completed',
      },
      {
        id: 'file-1',
        type: 'file_change',
        changes: [{ path: 'src/index.ts', kind: 'update' }],
        status: 'completed',
      },
      {
        id: 'message-1',
        type: 'agent_message',
        text: 'Codex result',
      },
    ],
    finalResponse: 'Codex result',
    usage: {
      input_tokens: 10,
      cached_input_tokens: 2,
      cache_write_input_tokens: 0,
      output_tokens: 5,
      reasoning_output_tokens: 1,
    },
  };
  const codexThread = {
    id: 'codex-thread-1',
    run: vi.fn(async () => codexTurn),
  };
  const codexInstance = {
    startThread: vi.fn(() => codexThread),
    resumeThread: vi.fn(() => codexThread),
  };

  return {
    codexInstance,
    codexThread,
    codexTurn,
    fields,
    opencodeClient,
    opencodeCreate,
    opencodeCreateClient,
    opencodePromptResponse,
    opencodeServer,
    opencodeSession,
  };
});

vi.mock('@opencode-ai/sdk', () => ({
  createOpencode: sdkMocks.opencodeCreate,
  createOpencodeClient: sdkMocks.opencodeCreateClient,
}));

vi.mock('@openai/codex-sdk', () => ({
  Codex: vi.fn(function MockCodex(this: unknown) {
    return sdkMocks.codexInstance;
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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
  it('registers the native Vestara runtime, OpenCode, and Codex', () => {
    const { runtime } = buildStack();
    const registry = new CodingAgentRuntimeRegistry();
    registry.register(new VestaraCodingAdapter(runtime));
    registry.register(new OpenCodeAdapter());
    registry.register(new CodexAdapter());
    expect(registry.has('vestara')).toBe(true);
    expect(registry.has('opencode')).toBe(true);
    expect(registry.has('codex')).toBe(true);
    expect(registry.list().length).toBe(3);
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

  it('prefers opencode by default for auto selection', async () => {
    const registry = new CodingAgentRuntimeRegistry();
    registry.register(new MemoryCodingAdapter('vestara', { capabilities: { shell: false, repositoryContext: false } }));
    registry.register(new MemoryCodingAdapter('codex', { capabilities: { shell: true, repositoryContext: true } }));
    registry.register(new MemoryCodingAdapter('opencode', { capabilities: { shell: true, repositoryContext: true } }));

    const selector = new RuntimeSelector(registry);
    const selected = await selector.select({ runtime: 'auto' });
    expect(selected.runtimeId).toBe('opencode');
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
  it('uses the OpenCode SDK for session lifecycle and execution', async () => {
    const adapter = new OpenCodeAdapter();
    const caps = await adapter.capabilities();
    expect(caps.sessions).toBe(true);
    expect(caps.resumableSessions).toBe(true);
    expect(caps.tools).toBe(true);

    const session = await adapter.createSession({
      agentId: 'vestara-developer',
      runId: 'r1',
      workspace: '/workspace',
      objective: 'Implement feature',
      systemPrompt: 'Use concise responses.',
    });
    expect(session.runtimeId).toBe('opencode');
    expect(sdkMocks.opencodeClient.session.create).toHaveBeenCalledWith({
      body: { title: 'Implement feature' },
      query: { directory: '/workspace' },
    });

    const resumed = await adapter.resumeSession(session.id);
    expect(resumed.resumed).toBe(true);
    expect(resumed.providerSessionId).toBe(sdkMocks.opencodeSession.id);

    const events: string[] = [];
    for await (const event of adapter.execute(session, { prompt: 'do it', tools: ['file.read', { name: 'generator.apply' }] })) {
      events.push(event.type);
    }
    expect(sdkMocks.opencodeClient.session.prompt).toHaveBeenCalledWith({
      path: { id: sdkMocks.opencodeSession.id },
      query: { directory: '/workspace' },
      signal: expect.any(AbortSignal),
      body: {
        agent: 'vestara-developer',
        system: 'Use concise responses.',
        tools: {
          'file.read': true,
          'generator.apply': true,
        },
        parts: [
          {
            type: 'text',
            text: 'Objective:\nImplement feature\n\nSystem instructions:\nUse concise responses.\n\ndo it',
          },
        ],
      },
    });
    await adapter.cancel(session.providerSessionId);
    await adapter.close(session.providerSessionId);

    expect(sdkMocks.opencodeClient.session.abort).toHaveBeenCalledWith({
      path: { id: sdkMocks.opencodeSession.id },
      query: { directory: '/workspace' },
    });
    expect(sdkMocks.opencodeClient.session.delete).toHaveBeenCalledWith({
      path: { id: sdkMocks.opencodeSession.id },
      query: { directory: '/workspace' },
    });
    expect(events).toContain('completed');
    expect(events).toContain('message');
    expect(events).toContain('usage');
  });
});

describe('CAR-012 Codex adapter', () => {
  it('uses the Codex SDK for threaded execution', async () => {
    const adapter = new CodexAdapter();
    const caps = await adapter.capabilities();
    expect(caps.sessions).toBe(true);
    expect(caps.cancellation).toBe(true);

    const session = await adapter.createSession({
      agentId: 'vestara-developer',
      runId: 'r2',
      workspace: '/workspace',
      objective: 'Fix the failing test',
      systemPrompt: 'Stay focused on the repository.',
    });
    expect(session.runtimeId).toBe('codex');
    expect(sdkMocks.codexInstance.startThread).toHaveBeenCalledWith({
      workingDirectory: '/workspace',
      skipGitRepoCheck: true,
    });

    const events: string[] = [];
    for await (const event of adapter.execute(session, { prompt: 'Apply the fix' })) {
      events.push(event.type);
    }
    expect(sdkMocks.codexThread.run).toHaveBeenCalledWith(
      expect.stringContaining('Objective:\nFix the failing test'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(events).toContain('thinking');
    expect(events).toContain('file-changed');
    expect(events).toContain('message');
    expect(events).toContain('usage');
    expect(events).toContain('completed');

    const resumed = await adapter.resumeSession('codex:codex-thread-1');
    expect(resumed.resumed).toBe(true);
    expect(resumed.providerSessionId).toBe('codex-thread-1');

    await adapter.cancel(session.providerSessionId);
    await adapter.close(session.providerSessionId);
  });
});
