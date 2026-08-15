import { describe, expect, it } from 'vitest';
import {
  AiModelCatalog,
  AiProviderRegistry,
  AiService,
  ModelsDevCatalogAdapter,
  CatalogCache,
  buildSnapshot,
  ModelRouter,
  OpenAiCompatibleAdapter,
  DEFAULT_AI_PROVIDERS,
  type AiModel,
  type AiProvider,
  type AiProviderAdapter,
  type ModelsDevCatalog,
} from '../../src/ai/index.js';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const gpt4o: AiModel = {
  id: 'gpt-4o',
  providerId: 'openai',
  name: 'GPT-4o',
  capabilities: { reasoning: false, tools: true, structuredOutput: true, functionCalling: true, vision: true, embeddings: false, streaming: true },
  modalities: ['text', 'image'],
  contextWindow: 128_000,
  maxOutputTokens: 16_384,
  pricing: { inputPerMillion: 2.5, outputPerMillion: 10 },
  openWeight: false,
  lifecycleStatus: 'ga',
};

const gpt4oMini: AiModel = {
  id: 'gpt-4o-mini',
  providerId: 'openai',
  name: 'GPT-4o mini',
  capabilities: { reasoning: false, tools: true, structuredOutput: true, functionCalling: true, vision: true, embeddings: false, streaming: true },
  modalities: ['text', 'image'],
  contextWindow: 128_000,
  pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  openWeight: false,
  lifecycleStatus: 'ga',
};

const o3: AiModel = {
  id: 'o3',
  providerId: 'openai',
  name: 'OpenAI o3',
  capabilities: { reasoning: true, tools: true, structuredOutput: true, functionCalling: true, vision: true, embeddings: false, streaming: true },
  modalities: ['text'],
  contextWindow: 200_000,
  pricing: { inputPerMillion: 2, outputPerMillion: 8 },
  openWeight: false,
  lifecycleStatus: 'ga',
};

function buildRuntime(options: { models?: readonly AiModel[]; providers?: readonly AiProvider[] } = {}) {
  const providers = options.providers ?? DEFAULT_AI_PROVIDERS.map((p) => ({ ...p, enabled: true }));
  const registry = new AiProviderRegistry();
  for (const provider of providers) {
    registry.register({
      provider,
      adapter: new OpenAiCompatibleAdapter(provider.id, provider.apiEndpoint ?? 'http://localhost:0/v1', 'test-key'),
    });
  }
  const catalog = new AiModelCatalog({ models: options.models ?? [gpt4o, gpt4oMini, o3] });
  const router = new ModelRouter(catalog, registry, { defaultProfile: 'auto', enabledProviders: [] });
  const service = new AiService({ router, catalog, providers: registry });
  return { service, catalog, registry, router };
}

function stubAdapter(): AiProviderAdapter {
  return {
    providerId: 'stub',
    supports: () => true,
    generate: async () => ({
      content: 'stub response',
      usage: { inputTokens: 3, outputTokens: 5 },
    }),
    stream: async function* () {
      yield { type: 'chunk', text: 'stub' };
      yield { type: 'done', usage: { inputTokens: 3, outputTokens: 5 } };
    },
  };
}

describe('AI-001/003 provider registry', () => {
  it('registers providers in priority order and tracks enablement', () => {
    const { registry } = buildRuntime();
    const listed = registry.listProviders();
    expect(listed[0]?.id).toBe('openai');
    expect(registry.listEnabledProviders().map((p) => p.id)).toContain('openai');
    registry.updateProvider({ ...registry.getProvider('openai'), enabled: false });
    expect(registry.listEnabledProviders().map((p) => p.id)).not.toContain('openai');
  });
});

describe('AI-004/012 model catalog + router', () => {
  it('resolves explicit provider/model selectors', async () => {
    const { service } = buildRuntime();
    const resolved = await service.resolveModel({ provider: 'openai', model: 'gpt-4o' });
    expect(resolved.modelId).toBe('gpt-4o');
    expect(resolved.providerId).toBe('openai');
  });

  it('resolves by capability requirements (structured output + tools)', async () => {
    const { service } = buildRuntime();
    const resolved = await service.resolveModel({
      requirements: { structuredOutput: true, tools: true, minContext: 100_000 },
      optimizeFor: 'quality',
    });
    expect(resolved.capabilities.structuredOutput).toBe(true);
    expect(resolved.capabilities.tools).toBe(true);
    expect(resolved.contextWindow).toBeGreaterThanOrEqual(100_000);
  });

  it('prefers reasoning models for the quality profile', async () => {
    const { service } = buildRuntime();
    const quality = await service.resolveModel({ requirements: { reasoning: true }, optimizeFor: 'quality' });
    expect(quality.modelId).toBe('o3');
    const cost = await service.resolveModel({ requirements: { tools: true }, optimizeFor: 'cost' });
    expect(cost.modelId).toBe('gpt-4o-mini');
  });

  it('rejects selectors no enabled model can satisfy', () => {
    const { service } = buildRuntime();
    expect(() =>
      service.resolveModel({ requirements: { reasoning: true, minContext: 1_000_000 } }),
    ).toThrow(/no enabled model|No enabled model/);
  });
});

describe('AI-007 generation + usage accounting', () => {
  it('records usage for every invocation', async () => {
    const registry = new AiProviderRegistry();
    registry.register({
      provider: { id: 'stub', name: 'Stub', type: 'native', enabled: true, priority: 1 },
      adapter: stubAdapter(),
    });
    const catalog = new AiModelCatalog({ models: [{ ...gpt4o, providerId: 'stub' }] });
    const router = new ModelRouter(catalog, registry, { defaultProfile: 'auto', enabledProviders: [] });
    const service = new AiService({ router, catalog, providers: registry });
    const result = await service.generate({
      consumer: { type: 'module', id: 'vestara.api-builder' },
      model: { provider: 'stub', model: 'gpt-4o' },
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.modelId).toBe('gpt-4o');
    expect(result.providerId).toBe('stub');
    expect(result.usage.inputTokens).toBe(3);
    expect(service.recentUsage('vestara.api-builder')).toHaveLength(1);
  });

  it('throws when no provider is enabled', async () => {
    const { service } = buildRuntime({ providers: DEFAULT_AI_PROVIDERS.map((p) => ({ ...p, enabled: false })) });
    await expect(
      service.generate({
        consumer: { type: 'module', id: 'x' },
        model: { provider: 'openai', model: 'gpt-4o' },
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow();
  });
});

describe('AI-005 models.dev adapter', () => {
  it('maps models.dev catalog into normalized Vestara models', () => {
    const adapter = new ModelsDevCatalogAdapter({ providers: [{ id: 'openai', name: 'OpenAI', type: 'openai-compatible', enabled: true, priority: 1 }] });
    const raw: ModelsDevCatalog = {
      providers: [
        {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'gpt-4o': {
              name: 'GPT-4o',
              tool_call: true,
              structured_output: true,
              vision: true,
              context: 128_000,
              max_tokens: 16_384,
              pricing: { input: 2.5, output: 10 },
              open_weights: false,
              lifecycle: 'GA',
            },
          },
        },
      ],
    };
    const models = adapter.toModels(raw);
    expect(models).toHaveLength(1);
    const model = models[0]!;
    expect(model.providerId).toBe('openai');
    expect(model.capabilities.tools).toBe(true);
    expect(model.capabilities.structuredOutput).toBe(true);
    expect(model.contextWindow).toBe(128_000);
    expect(model.pricing?.inputPerMillion).toBe(2.5);
    expect(model.lifecycleStatus).toBe('ga');
  });

  it('filters by open-weight when requested', () => {
    const adapter = new ModelsDevCatalogAdapter({ openWeightOnly: true, providers: [{ id: 'openai', name: 'OpenAI', type: 'native', enabled: true, priority: 1 }] });
    const raw: ModelsDevCatalog = {
      providers: [
        {
          id: 'openai',
          models: {
            'gpt-4o': { open_weights: false, context: 128_000 },
            'llama-3': { open_weights: true, context: 8192 },
          },
        },
      ],
    };
    const models = adapter.toModels(raw);
    expect(models).toHaveLength(1);
    expect(models[0]?.id).toBe('llama-3');
  });
});

describe('AI-006 catalog cache + offline snapshot', () => {
  it('persists a validated snapshot and reloads it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vestara-ai-cache-'));
    const cache = new CatalogCache(join(dir, 'catalog.json'));
    const snapshot = buildSnapshot([...DEFAULT_AI_PROVIDERS], [gpt4o], 'models.dev');
    await cache.save(snapshot);
    const loaded = await cache.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.models).toHaveLength(1);
    expect(loaded!.checksum).toBe(snapshot.checksum);
  });

  it('rejects tampered snapshots', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vestara-ai-cache-'));
    const path = join(dir, 'catalog.json');
    const cache = new CatalogCache(path);
    const snapshot = buildSnapshot([...DEFAULT_AI_PROVIDERS], [gpt4o], 'models.dev');
    await cache.save(snapshot);
    const raw = JSON.parse(await readFile(path, 'utf8')) as { models: unknown[] };
    raw.models.push({} as never);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, JSON.stringify(raw), 'utf8');
    const loaded = await cache.load();
    expect(loaded).toBeNull();
  });
});
