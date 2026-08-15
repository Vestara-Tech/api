import { describe, expect, it } from 'vitest';
import {
  AgentRegistry,
  BUILTIN_AGENTS,
  AgentRunStateMachine,
  AgentRuntime,
} from '../../src/agent/index.js';
import {
  SkillRegistry,
  SkillResolver,
} from '../../src/skill/index.js';
import {
  ToolRegistry,
  ToolRuntime,
  ToolPolicy,
} from '../../src/tool/index.js';
import { AiModelCatalog, AiProviderRegistry, AiService, ModelRouter, type AiModel, type AiProviderAdapter } from '../../src/ai/index.js';
import { defineBuiltinSkills } from '../../src/bootstrap/skills.js';

const STUB_MODEL: AiModel = {
  id: 'stub-model',
  providerId: 'stub',
  name: 'Stub Model',
  capabilities: { reasoning: true, tools: true, structuredOutput: true, functionCalling: true, vision: false, embeddings: false, streaming: true },
  modalities: ['text'],
  contextWindow: 100_000,
  openWeight: false,
  lifecycleStatus: 'ga',
};

/**
 * A stub AI whose first call requests a tool call and whose second call returns
 * a final answer incorporating the tool result.
 */
function toolLoopAi(): { service: AiService; calls: { messages: unknown[] }[] } {
  const calls: { messages: unknown[] }[] = [];
  let turn = 0;
  const registry = new AiProviderRegistry();
  const adapter: AiProviderAdapter = {
    providerId: 'stub',
    supports: () => true,
    generate: async (ctx, request) => {
      calls.push({ messages: request.messages as unknown[] });
      turn += 1;
      if (turn === 1) {
        return {
          content: '',
          usage: { inputTokens: 2, outputTokens: 1 },
          toolCalls: [{ id: 'call_1', name: 'api.definition.read', arguments: '{}' }],
        };
      }
      // Second turn: the tool result was fed back into the conversation.
      const hasToolResult = (request.messages as { role?: string }[]).some((m) => m.role === 'tool');
      return {
        content: hasToolResult ? 'final answer after tool' : 'final answer',
        usage: { inputTokens: 3, outputTokens: 2 },
      };
    },
    stream: async function* () {},
  };
  registry.register({ provider: { id: 'stub', name: 'Stub', type: 'native', enabled: true, priority: 1 }, adapter });
  const catalog = new AiModelCatalog({ models: [STUB_MODEL] });
  const router = new ModelRouter(catalog, registry, { defaultProfile: 'auto', enabledProviders: [] });
  const service = new AiService({ router, catalog, providers: registry });
  return { service, calls };
}

function buildPlatform(ai: AiService) {
  const tools = new ToolRegistry();
  const readCalls: { agentId: string; runId: string; input: unknown }[] = [];
  tools.registerContribution({
    toolId: 'api.definition.read',
    version: '1',
    description: 'read',
    inputSchema: {},
    outputSchema: {},
    capabilities: ['builder.definition.read'],
    risk: 'read',
    handler: async (ctx, input) => {
      readCalls.push({ agentId: ctx.agentId, runId: ctx.runId, input });
      return { definitions: [] };
    },
  });
  const toolRuntime = new ToolRuntime({ registry: tools, policy: new ToolPolicy({ autoApproveRisks: ['read', 'write'] }) });
  const agents = new AgentRegistry();
  for (const a of BUILTIN_AGENTS) agents.register(a);
  const skills = new SkillRegistry();
  for (const s of defineBuiltinSkills()) skills.register(s);
  const runs = new AgentRunStateMachine();
  const runtime = new AgentRuntime({ agents, runs, tools: toolRuntime, skills, ai });
  return { runtime, runs, readCalls };
}

describe('AGENT-007 tool-call loop', () => {
  it('executes tool calls and feeds results back to the model', async () => {
    const { service, calls } = toolLoopAi();
    const { runtime, runs, readCalls } = buildPlatform(service);

    const run = runtime.start({ agentId: 'vestara-developer', goal: 'list definitions' });
    await new Promise((r) => setTimeout(r, 150));
    const final = runs.get(run.id);

    expect(readCalls).toHaveLength(1);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    // The second AI call received the tool result message.
    expect(final.status).toBe('completed');
    expect(final.result).toContain('final answer after tool');

    // Evidence: tool-call and tool-result events were emitted.
    const events = runs.eventsFor(run.id);
    expect(events.some((e) => e.type === 'tool-call')).toBe(true);
    expect(events.some((e) => e.type === 'tool-result')).toBe(true);
  });

  it('suspends waiting for approval when a control tool is requested without approval', async () => {
    const registry = new AiProviderRegistry();
    let turn = 0;
    const adapter: AiProviderAdapter = {
      providerId: 'stub',
      supports: () => true,
      generate: async () => {
        turn += 1;
        return {
          content: '',
          usage: { inputTokens: 1, outputTokens: 1 },
          toolCalls: turn === 1 ? [{ id: 'c1', name: 'api.definition.publish', arguments: '{}' }] : [],
        };
      },
      stream: async function* () {},
    };
    registry.register({ provider: { id: 'stub', name: 'Stub', type: 'native', enabled: true, priority: 1 }, adapter });
    const catalog = new AiModelCatalog({ models: [STUB_MODEL] });
    const router = new ModelRouter(catalog, registry, { defaultProfile: 'auto', enabledProviders: [] });
    const ai = new AiService({ router, catalog, providers: registry });

    const tools = new ToolRegistry();
    tools.registerContribution({
      toolId: 'api.definition.publish',
      version: '1',
      description: 'publish',
      inputSchema: {},
      outputSchema: {},
      capabilities: ['builder.definition.publish'],
      risk: 'control',
      handler: async () => ({ published: true }),
    });
    const toolRuntime = new ToolRuntime({ registry: tools, policy: new ToolPolicy({ autoApproveRisks: ['read'] }) });
    const agents = new AgentRegistry();
    for (const a of BUILTIN_AGENTS) agents.register(a);
    const skills = new SkillRegistry();
    const runs = new AgentRunStateMachine();
    const runtime = new AgentRuntime({ agents, runs, tools: toolRuntime, skills, ai });

    const run = runtime.start({ agentId: 'vestara-developer', goal: 'publish' });
    await new Promise((r) => setTimeout(r, 150));
    const final = runs.get(run.id);
    expect(['waiting-for-approval', 'completed', 'failed']).toContain(final.status);
    const events = runs.eventsFor(run.id);
    expect(events.some((e) => e.type === 'approval-requested')).toBe(true);
  });
});
