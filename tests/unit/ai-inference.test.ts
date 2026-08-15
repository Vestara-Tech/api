import { describe, expect, it } from 'vitest';
import {
  AiModelCatalog,
  AiProviderRegistry,
  AiService,
  BudgetPolicy,
  CostEstimator,
  ModelRouter,
  type AiModel,
  type AiProviderAdapter,
  type AiProviderStreamEvent,
} from '../../src/ai/index.js';

const gpt4o: AiModel = {
  id: 'gpt-4o',
  providerId: 'openai',
  name: 'GPT-4o',
  capabilities: { reasoning: false, tools: true, structuredOutput: true, functionCalling: true, vision: true, embeddings: false, streaming: true },
  modalities: ['text'],
  contextWindow: 128_000,
  pricing: { inputPerMillion: 2.5, outputPerMillion: 10, cacheReadPerMillion: 1.25 },
  openWeight: false,
  lifecycleStatus: 'ga',
};

const gpt4oMini: AiModel = {
  id: 'gpt-4o-mini',
  providerId: 'openai',
  name: 'GPT-4o mini',
  capabilities: { reasoning: false, tools: true, structuredOutput: true, functionCalling: true, vision: true, embeddings: false, streaming: true },
  modalities: ['text'],
  contextWindow: 128_000,
  pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  openWeight: false,
  lifecycleStatus: 'ga',
};

const tinyNoTools: AiModel = {
  id: 'tiny',
  providerId: 'openai',
  name: 'Tiny',
  capabilities: { reasoning: false, tools: false, structuredOutput: false, functionCalling: false, vision: false, embeddings: false, streaming: true },
  modalities: ['text'],
  contextWindow: 4_096,
  pricing: { inputPerMillion: 0.02, outputPerMillion: 0.04 },
  openWeight: true,
  lifecycleStatus: 'ga',
};

const embedder: AiModel = {
  id: 'text-embedding-3-small',
  providerId: 'openai',
  name: 'Embedding',
  capabilities: { reasoning: false, tools: false, structuredOutput: false, functionCalling: false, vision: false, embeddings: true, streaming: false },
  modalities: ['text'],
  contextWindow: 8_191,
  pricing: { inputPerMillion: 0.02 },
  openWeight: false,
  lifecycleStatus: 'ga',
};

function toolAdapter(): AiProviderAdapter {
  return {
    providerId: 'openai',
    supports: () => true,
    generate: async () => ({
      content: '',
      usage: { inputTokens: 10, outputTokens: 5 },
      toolCalls: [{ id: 'call_1', name: 'api.definition.validate', arguments: '{"id":"x"}' }],
    }),
    stream: async function* () {},
  };
}

function embedAdapter(): AiProviderAdapter {
  return {
    providerId: 'openai',
    supports: () => true,
    generate: async () => ({ content: 'x', usage: { inputTokens: 1, outputTokens: 1 } }),
    stream: async function* (): AsyncGenerator<AiProviderStreamEvent> {},
    embed: async (_ctx, request) => ({
      embeddings: request.input.map((s) => [s.length, 0]),
      usage: { inputTokens: request.input.length, outputTokens: 0 },
    }),
  };
}

function build(options: { adapter?: AiProviderAdapter; models?: readonly AiModel[] } = {}) {
  const registry = new AiProviderRegistry();
  registry.register({ provider: { id: 'openai', name: 'OpenAI', type: 'openai-compatible', enabled: true, priority: 1, apiEndpoint: 'http://localhost:0/v1' }, adapter: options.adapter ?? toolAdapter() });
  const catalog = new AiModelCatalog({ models: options.models ?? [gpt4o, gpt4oMini, tinyNoTools, embedder] });
  const router = new ModelRouter(catalog, registry, { defaultProfile: 'auto', enabledProviders: [] });
  const costs = new CostEstimator();
  const budgets = new BudgetPolicy();
  const service = new AiService({ router, catalog, providers: registry, costs, budgets });
  return { service, catalog, router, costs, budgets };
}

describe('AI-010 tool calling', () => {
  it('surfaces tool calls requested by the model', async () => {
    const { service } = build();
    const result = await service.generate({
      consumer: { type: 'agent', id: 'dev' },
      model: { provider: 'openai', model: 'gpt-4o' },
      messages: [{ role: 'user', content: 'validate the api' }],
      tools: [{ name: 'api.definition.validate', description: 'validate', inputSchema: {} }],
    });
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0]!.name).toBe('api.definition.validate');
  });
});

describe('AI-011 embeddings', () => {
  it('embeds text through an embedding-capable adapter', async () => {
    const { service } = build({ adapter: embedAdapter() });
    const result = await service.embed({
      consumer: { type: 'module', id: 'retrieval' },
      model: { provider: 'openai', model: 'text-embedding-3-small' },
      input: ['hello', 'world'],
    });
    expect(result.embeddings).toHaveLength(2);
    expect(result.embeddings[0]).toEqual([5, 0]);
    expect(service.recentUsage('retrieval')).toHaveLength(1);
  });

  it('rejects embeddings when the adapter lacks the capability', async () => {
    const { service } = build({ adapter: toolAdapter() });
    await expect(
      service.embed({ consumer: { type: 'module', id: 'r' }, model: { provider: 'openai', model: 'gpt-4o' }, input: 'x' }),
    ).rejects.toThrow(/does not support embeddings/);
  });
});

describe('AI-015 capability-preserving fallback', () => {
  it('never falls back to a model lacking required capabilities', async () => {
    const registry = new AiProviderRegistry();
    registry.register({ provider: { id: 'openai', name: 'OpenAI', type: 'openai-compatible', enabled: true, priority: 1 }, adapter: {
      providerId: 'openai',
      supports: () => true,
      generate: async () => ({ content: 'ok', usage: { inputTokens: 1, outputTokens: 1 } }),
      stream: async function* () {},
    } });
    const catalog = new AiModelCatalog({ models: [gpt4o, gpt4oMini, tinyNoTools] });
    const router = new ModelRouter(catalog, registry, { defaultProfile: 'auto', enabledProviders: [] });
    const service = new AiService({ router, catalog, providers: registry });

    // Resolve a chain with fallbackCount 5; the tiny model (no tools) must never be selected.
    const result = await service.generate({
      consumer: { type: 'module', id: 'x' },
      model: { requirements: { tools: true, structuredOutput: true }, optimizeFor: 'cost' },
      messages: [{ role: 'user', content: 'hi' }],
      fallbackCount: 5,
    });
    expect(['gpt-4o', 'gpt-4o-mini']).toContain(result.modelId);
  });
});

describe('AI-019/020 usage + cost estimation', () => {
  it('records estimated cost from catalog pricing', async () => {
    const { service } = build();
    await service.generate({
      consumer: { type: 'module', id: 'billing' },
      model: { provider: 'openai', model: 'gpt-4o' },
      messages: [{ role: 'user', content: 'hi' }],
    });
    const record = service.recentUsage('billing')[0]!;
    expect(record.providerId).toBe('openai');
    expect(record.modelId).toBe('gpt-4o');
    // 10 input + 5 output at $2.5/$10 per million = 0.000025 + 0.00005 = 0.000075
    expect(record.estimatedCostUsd).toBeCloseTo(0.000075, 6);
  });

  it('estimates cost with cached-token discount', () => {
    const estimator = new CostEstimator();
    const cost = estimator.estimate(gpt4o.pricing, { inputTokens: 1_100_000, outputTokens: 100_000, cachedTokens: 1_000_000 });
    // uncached input 100k @2.5 = 0.25, cached 1M @1.25 = 1.25, output 100k @10 = 1.0 => 2.50
    expect(cost).toBeCloseTo(2.5, 3);
  });
});

describe('AI-021 budget policy', () => {
  it('blocks a consumer once its daily cost budget is exhausted', async () => {
    const { service, budgets } = build();
    budgets.setBudget({ consumerId: 'billing', dailyCostUsd: 0.000075 });
    await service.generate({
      consumer: { type: 'module', id: 'billing' },
      model: { provider: 'openai', model: 'gpt-4o' },
      messages: [{ role: 'user', content: 'hi' }],
    });
    await expect(
      service.generate({
        consumer: { type: 'module', id: 'billing' },
        model: { provider: 'openai', model: 'gpt-4o' },
        messages: [{ role: 'user', content: 'again' }],
      }),
    ).rejects.toThrow(/budget exceeded/);
  });

  it('does not affect consumers without a budget', async () => {
    const { service } = build();
    for (let i = 0; i < 3; i += 1) {
      await service.generate({
        consumer: { type: 'module', id: 'unlimited' },
        model: { provider: 'openai', model: 'gpt-4o' },
        messages: [{ role: 'user', content: 'hi' }],
      });
    }
    expect(service.recentUsage('unlimited')).toHaveLength(3);
  });
});
