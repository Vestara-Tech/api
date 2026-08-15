import { randomId } from '../../core/identifiers.js';
import type {
  AiEmbeddingRequest,
  AiEmbeddingResult,
  AiGenerateRequest,
  AiGenerateResult,
  AiStreamEvent,
  AiUsage,
  AiUsageRecord,
} from '../domain/contracts.js';
import type { AiModelCatalog } from '../catalog/model-catalog.js';
import type { AiProviderRegistry } from '../providers/provider-registry.js';
import { ModelRouter } from './model-router.js';

export interface AiRuntimeOptions {
  readonly router: ModelRouter;
  readonly catalog: AiModelCatalog;
  readonly providers: AiProviderRegistry;
}

export interface AiService {
  generate(request: AiGenerateRequest): Promise<AiGenerateResult>;
  stream(request: AiGenerateRequest): AsyncIterable<AiStreamEvent>;
  embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResult>;
  resolveModel(selector: AiGenerateRequest['model']): Promise<ReturnType<ModelRouter['resolve']>>;
  recentUsage(consumerId?: string): readonly AiUsageRecord[];
}

/**
 * AI-007/008/009/011 — The shared AI runtime. Consuming modules depend on this
 * service, never on a concrete provider. Handles model resolution, adapter
 * dispatch, fallback, streaming, and usage accounting.
 */
export class AiService implements AiService {
  private readonly router: ModelRouter;
  private readonly catalog: AiModelCatalog;
  private readonly providers: AiProviderRegistry;
  private readonly records: AiUsageRecord[] = [];

  constructor(options: AiRuntimeOptions) {
    this.router = options.router;
    this.catalog = options.catalog;
    this.providers = options.providers;
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const requestId = randomId('ai');
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const resolved = this.router.resolve(request.model);
    const fallbackChain = this.buildFallbackChain(request.model, request.fallbackCount ?? 0);

    let lastError: unknown = null;
    let fallbackCount = 0;
    for (const target of [resolved, ...fallbackChain]) {
      try {
        const entry = this.providers.adapterFor(target.providerId);
        if (!entry) continue;
        const model = this.catalog.get(target.providerId, target.modelId);
        const normalized = normalizeRequest(request, target.providerId, target.modelId);
        const result = await entry.adapter.generate({ requestId, consumerId: request.consumer.id }, normalized);
        const latencyMs = Date.now() - startedMs;
        this.record(requestId, request.consumer.id, target.providerId, target.modelId, result.usage, latencyMs, startedAt, new Date().toISOString(), fallbackCount);
        return {
          content: result.content,
          modelId: target.modelId,
          providerId: target.providerId,
          usage: result.usage,
          latencyMs,
          fallbackCount,
        };
      } catch (err) {
        lastError = err;
        fallbackCount += 1;
      }
    }
    throw new Error(`AI generation failed for ${request.consumer.id}: ${(lastError as Error)?.message ?? 'no provider available'}`);
  }

  async *stream(request: AiGenerateRequest): AsyncIterable<AiStreamEvent> {
    const requestId = randomId('ai');
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const resolved = this.router.resolve(request.model);
    const entry = this.providers.adapterFor(resolved.providerId);
    if (!entry) {
      yield { type: 'error', message: `No adapter for provider "${resolved.providerId}"` };
      return;
    }
    const model = this.catalog.get(resolved.providerId, resolved.modelId);
    const normalized = normalizeRequest(request, resolved.providerId, resolved.modelId);
    let usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
    try {
      for await (const event of entry.adapter.stream({ requestId, consumerId: request.consumer.id }, normalized)) {
        if (event.type === 'done') usage = event.usage;
        if (event.type === 'error') {
          yield event;
          return;
        }
        yield event as AiStreamEvent;
      }
      const latencyMs = Date.now() - startedMs;
      this.record(requestId, request.consumer.id, resolved.providerId, resolved.modelId, usage, latencyMs, startedAt, new Date().toISOString(), 0);
    } catch (err) {
      yield { type: 'error', message: (err as Error).message };
    }
  }

  async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResult> {
    throw new Error('AI embed requires an embedding-capable provider adapter (AI-011)');
  }

  resolveModel(selector: AiGenerateRequest['model']): Promise<ReturnType<ModelRouter['resolve']>> {
    return Promise.resolve(this.router.resolve(selector));
  }

  get usage(): readonly AiUsageRecord[] {
    return this.records;
  }

  recentUsage(consumerId?: string): readonly AiUsageRecord[] {
    const all = [...this.records].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return consumerId !== undefined ? all.filter((r) => r.consumerId === consumerId) : all;
  }

  private buildFallbackChain(selector: AiGenerateRequest['model'], count: number): { providerId: string; modelId: string }[] {
    if (count <= 0 || !('requirements' in selector)) return [];
    const base = this.router.resolve(selector);
    const alternatives = this.catalog
      .list()
      .filter((m) => m.providerId !== base.providerId || m.id !== base.modelId)
      .filter((m) => this.providers.adapterFor(m.providerId) !== undefined)
      .slice(0, count);
    return alternatives.map((m) => ({ providerId: m.providerId, modelId: m.id }));
  }

  private record(
    requestId: string,
    consumerId: string,
    providerId: string,
    modelId: string,
    usage: AiUsage,
    latencyMs: number,
    startedAt: string,
    completedAt: string,
    fallbackCount: number,
  ): void {
    this.records.push({
      requestId,
      consumerId,
      providerId,
      modelId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      ...(usage.cachedTokens !== undefined ? { cachedTokens: usage.cachedTokens } : {}),
      ...(usage.estimatedCostUsd !== undefined ? { estimatedCostUsd: usage.estimatedCostUsd } : {}),
      latencyMs,
      startedAt,
      completedAt,
      fallbackCount,
    });
  }
}

function normalizeRequest(request: AiGenerateRequest, providerId: string, modelId: string): {
  providerId: string;
  modelId: string;
  messages: readonly unknown[];
  system?: string;
  tools?: readonly unknown[];
  outputSchema?: unknown;
  temperature?: number;
  maxTokens?: number;
} {
  return {
    providerId,
    modelId,
    messages: request.messages as readonly unknown[],
    ...(request.system !== undefined ? { system: request.system } : {}),
    ...(request.tools !== undefined ? { tools: request.tools } : {}),
    ...(request.output?.schema !== undefined ? { outputSchema: request.output.schema } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.maxTokens !== undefined ? { maxTokens: request.maxTokens } : {}),
  };
}
