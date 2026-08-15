import { describe, expect, it } from 'vitest';
import { AiModelCatalog } from '../../src/ai/catalog/model-catalog.js';
import { AiProviderRegistry } from '../../src/ai/providers/provider-registry.js';
import { OpenAiCompatibleAdapter } from '../../src/ai/providers/openai-compatible.js';
import { buildAiService } from '../../src/ai/service/ai-service.js';
import {
  AiSessionManager,
  BudgetEngine,
  UsageAggregator,
  AiTracer,
  buildAiEvidence,
  buildAiPlatformV2,
  InMemoryAiProviderState,
} from '../../src/ai/v2/index.js';
import { AiRuntimeV2 } from '../../src/ai/v2/runtime-v2.js';

function catalog() {
  const catalog = new AiModelCatalog();
  catalog.upsert({ id: 'gpt-4o-mini', providerId: 'openai', name: 'GPT-4o mini', capabilities: { reasoning: false, tools: true, structuredOutput: true, functionCalling: true, vision: true, embeddings: false, streaming: true }, modalities: ['text'], contextWindow: 128000, maxOutputTokens: 16000, pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 }, openWeight: false, lifecycleStatus: 'ga' });
  return catalog;
}

function build() {
  const cat = catalog();
  const registry = new AiProviderRegistry();
  registry.register({ provider: { id: 'openai', name: 'OpenAI', type: 'openai-compatible', enabled: true, priority: 10 }, adapter: new OpenAiCompatibleAdapter('openai', 'http://localhost:1', '') });
  const states = new InMemoryAiProviderState();
  states.upsert({ id: 'openai', name: 'OpenAI', installed: true, configured: true, enabled: true, health: 'healthy' });
  const platform = buildAiPlatformV2({ catalog: cat, providers: registry, providerStates: states.listProviderStates() });
  const { service } = buildAiService({ providers: registry.listProviders(), models: [], defaultApiEndpoint: 'http://localhost:1' });
  const sessions = new AiSessionManager();
  const budgets = new BudgetEngine();
  const usage = new UsageAggregator();
  const tracer = new AiTracer();
  const runtime = new AiRuntimeV2({ service, platform, sessions, budgets, usage, tracer });
  return { runtime, sessions, budgets, usage, tracer, platform };
}

describe('AI2-011 session runtime', () => {
  it('creates sessions and records usage', () => {
    const { sessions } = build();
    const session = sessions.createSession({ consumerId: 'agent-1', profileId: 'vestara.coding', title: 'Dev Agent' });
    expect(session.requestCount).toBe(0);

    const conversation = sessions.newConversation(session.id);
    sessions.appendMessage(conversation.id, { role: 'user', content: 'hello' });
    const updated = sessions.appendMessage(conversation.id, { role: 'assistant', content: 'hi' });
    expect(updated.messages).toHaveLength(2);
    expect(sessions.listConversations(session.id)).toHaveLength(1);
  });
});

describe('AI2-016 budget engine', () => {
  it('denies on hard limits and hints profile switch on thresholds', () => {
    const budgets = new BudgetEngine();
    budgets.setLimit({ scope: 'agent', scopeId: 'dev', maxRequests: 10, onThreshold: 'warn', thresholdRatio: 0.5 });
    budgets.record('agent', 'dev', { usd: 0, tokens: 0, requests: 4 });
    expect(budgets.check('agent', 'dev').thresholdMet).toBe(false);

    budgets.record('agent', 'dev', { usd: 0, tokens: 0, requests: 1 });
    expect(budgets.check('agent', 'dev').thresholdMet).toBe(true);

    for (let i = 0; i < 5; i++) budgets.record('agent', 'dev', { usd: 0, tokens: 0, requests: 1 });
    expect(() => budgets.authorize('agent', 'dev')).toThrow(/budget/);
  });
});

describe('AI2-017 usage aggregation', () => {
  it('aggregates records and groups by dimension', () => {
    const usage = new UsageAggregator();
    usage.record({ requestId: 'r1', consumerId: 'agent-1', providerId: 'openai', modelId: 'gpt-4o-mini', latencyMs: 100, startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:00:01Z', fallbackCount: 0, inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.01 });
    usage.record({ requestId: 'r2', consumerId: 'agent-1', providerId: 'openai', modelId: 'gpt-4o-mini', latencyMs: 200, startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:00:01Z', fallbackCount: 1, inputTokens: 200, outputTokens: 100, estimatedCostUsd: 0.02 });

    const agg = usage.aggregate();
    expect(agg.requests).toBe(2);
    expect(agg.inputTokens).toBe(300);
    expect(agg.fallbacks).toBe(1);
    expect(agg.p95LatencyMs).toBe(200);

    const grouped = usage.groupBy('provider');
    expect(grouped.groups[0]!.key).toBe('openai');
    expect(grouped.groups[0]!.requests).toBe(2);
  });
});

describe('AI2-018/019 tracing + evidence', () => {
  it('records pipeline steps and total duration', () => {
    const tracer = new AiTracer();
    const trace = tracer.begin('req_1', 'openai', 'gpt-4o-mini');
    tracer.step(trace.traceId, 'context.assembly', 31);
    tracer.step(trace.traceId, 'model.request', 1832);
    const final = tracer.get(trace.traceId)!;
    expect(final.steps).toHaveLength(2);
    expect(final.totalMs).toBe(1863);
  });

  it('builds deterministic evidence', () => {
    const evidence = buildAiEvidence({
      requestId: 'req_1',
      profileId: 'vestara.coding',
      providerId: 'openai',
      modelId: 'gpt-4o-mini',
      routing: { strategy: 'balanced', selectedFrom: 'candidate-ranking', reason: 'best' },
      usage: { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.01 },
      traceId: 'tr_1',
    });
    expect(evidence.evidenceHash).toBeTruthy();
    expect(evidence.routing.strategy).toBe('balanced');
  });
});

describe('AI2 runtime v2 end-to-end', () => {
  it('executes a request through the governed path (falls back to error when provider unreachable)', async () => {
    const { runtime, sessions } = build();
    const session = sessions.createSession({ consumerId: 'agent-1', profileId: 'vestara.fast' });
    await expect(
      runtime.execute({
        consumer: { type: 'agent', id: 'agent-1' },
        profileId: 'vestara.fast',
        sessionId: session.id,
        messages: [{ role: 'user', content: 'hi' }],
        budget: { scope: 'agent', scopeId: 'agent-1' },
      }),
    ).rejects.toBeTruthy();
  });
});
