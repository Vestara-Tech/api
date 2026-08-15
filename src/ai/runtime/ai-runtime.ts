import { randomId } from '../../core/identifiers.js';
import type {
  AiEmbeddingRequest,
  AiEmbeddingResult,
  AiGenerateRequest,
  AiGenerateResult,
  AiModelRequirements,
  AiStreamEvent,
  AiUsage,
  AiUsageRecord,
} from '../domain/contracts.js';
import type { AiModelCatalog } from '../catalog/model-catalog.js';
import type { AiProviderRegistry } from '../providers/provider-registry.js';
import type { ResolvedAiModel } from '../domain/contracts.js';
import { ModelRouter } from './model-router.js';
import { CostEstimator } from '../policies/cost-estimator.js';
import { BudgetPolicy } from '../policies/budget-policy.js';

export interface AiRuntimeOptions {
  readonly router: ModelRouter;
  readonly catalog: AiModelCatalog;
  readonly providers: AiProviderRegistry;
  readonly budgets?: BudgetPolicy;
  readonly costs?: CostEstimator;
}

export interface AiService {
  generate(request: AiGenerateRequest): Promise<AiGenerateResult>;
  stream(request: AiGenerateRequest): AsyncIterable<AiStreamEvent>;
  embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResult>;
  resolveModel(selector: AiGenerateRequest['model']): Promise<ResolvedAiModel>;
  recentUsage(consumerId?: string): readonly AiUsageRecord[];
  budgets: BudgetPolicy;
}

/**
 * AI-007/008/009/010/011/015/019/020 — The shared AI runtime. Consuming modules
 * depend on this service, never on a concrete provider. Handles model
 * resolution, adapter dispatch, capability-preserving fallback, streaming,
 * embeddings, cost estimation, budget enforcement and usage accounting.
 */
export class AiService implements AiService {
  private readonly router: ModelRouter;
  private readonly catalog: AiModelCatalog;
  private readonly providers: AiProviderRegistry;
  private readonly costs: CostEstimator;
  budgets: BudgetPolicy;
  private readonly records: AiUsageRecord[] = [];

  constructor(options: AiRuntimeOptions) {
    this.router = options.router;
    this.catalog = options.catalog;
    this.providers = options.providers;
    this.costs = options.costs ?? new CostEstimator();
    this.budgets = options.budgets ?? new BudgetPolicy();
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const requestId = randomId('ai');
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    // Budget gate before any provider call (AI-021).
    const budget = this.budgets.check(request.consumer.id, this.records);
    if (!budget.allowed) throw new Error(`AI budget exceeded: ${budget.reason}`);

    const resolved = this.router.resolve(request.model);
    const requirements = 'requirements' in request.model ? request.model.requirements : undefined;
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
        const estimatedCostUsd = this.costs.estimate(model.pricing, result.usage);
        this.record(requestId, request.consumer.id, target.providerId, target.modelId, result.usage, estimatedCostUsd, latencyMs, startedAt, new Date().toISOString(), fallbackCount);
        return {
          content: result.content,
          modelId: target.modelId,
          providerId: target.providerId,
          usage: result.usage,
          latencyMs,
          fallbackCount,
          ...(result.toolCalls && result.toolCalls.length > 0 ? { toolCalls: result.toolCalls } : {}),
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
    const budget = this.budgets.check(request.consumer.id, this.records);
    if (!budget.allowed) {
      yield { type: 'error', message: `AI budget exceeded: ${budget.reason}` };
      return;
    }
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
      const estimatedCostUsd = this.costs.estimate(model.pricing, usage);
      this.record(requestId, request.consumer.id, resolved.providerId, resolved.modelId, usage, estimatedCostUsd, latencyMs, startedAt, new Date().toISOString(), 0);
    } catch (err) {
      yield { type: 'error', message: (err as Error).message };
    }
  }

  async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResult> {
    const requestId = randomId('ai');
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const budget = this.budgets.check(request.consumer.id, this.records);
    if (!budget.allowed) throw new Error(`AI budget exceeded: ${budget.reason}`);

    const resolved = this.router.resolve(request.model);
    const entry = this.providers.adapterFor(resolved.providerId);
    if (!entry?.adapter.embed) {
      throw new Error(`AI provider "${resolved.providerId}" does not support embeddings`);
    }
    const model = this.catalog.get(resolved.providerId, resolved.modelId);
    const inputs = typeof request.input === 'string' ? [request.input] : request.input;
    const result = await entry.adapter.embed({ requestId, consumerId: request.consumer.id }, { providerId: resolved.providerId, modelId: resolved.modelId, input: inputs });
    const latencyMs = Date.now() - startedMs;
    const estimatedCostUsd = this.costs.estimate(model.pricing, result.usage);
    this.record(requestId, request.consumer.id, resolved.providerId, resolved.modelId, result.usage, estimatedCostUsd, latencyMs, startedAt, new Date().toISOString(), 0);
    return {
      modelId: resolved.modelId,
      providerId: resolved.providerId,
      embeddings: result.embeddings,
      usage: result.usage,
    };
  }

  resolveModel(selector: AiGenerateRequest['model']): Promise<ResolvedAiModel> {
    return Promise.resolve(this.router.resolve(selector));
  }

  get usage(): readonly AiUsageRecord[] {
    return this.records;
  }

  recentUsage(consumerId?: string): readonly AiUsageRecord[] {
    const all = [...this.records].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return consumerId !== undefined ? all.filter((r) => r.consumerId === consumerId) : all;
  }

  /**
   * AI-015 — Build a fallback chain that PRESERVES capability requirements.
   * Never fall from a tools=true/structuredOutput=true model to a cheap model
   * incapable of either just because it responded.
   */
  private buildFallbackChain(selector: AiGenerateRequest['model'], count: number): ResolvedAiModel[] {
    if (count <= 0 || !('requirements' in selector)) return [];
    const base = this.router.resolve(selector);
    const requirements = selector.requirements;
    const alternatives = this.catalog
      .list()
      .filter((m) => m.providerId !== base.providerId || m.id !== base.modelId)
      .filter((m) => matches(m, requirements))
      .filter((m) => this.providers.adapterFor(m.providerId) !== undefined)
      .slice(0, count);
    return alternatives.map((m) => toResolved(m));
  }

  private record(
    requestId: string,
    consumerId: string,
    providerId: string,
    modelId: string,
    usage: AiUsage,
    estimatedCostUsd: number | undefined,
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
      ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
      latencyMs,
      startedAt,
      completedAt,
      fallbackCount,
    });
  }
}

function matches(
  model: { capabilities: { reasoning: boolean; tools: boolean; structuredOutput: boolean; functionCalling: boolean; vision: boolean; embeddings: boolean }; contextWindow: number },
  requirements: AiModelRequirements,
): boolean {
  if (requirements.reasoning !== undefined && model.capabilities.reasoning !== requirements.reasoning) return false;
  if (requirements.tools !== undefined && model.capabilities.tools !== requirements.tools) return false;
  if (requirements.structuredOutput !== undefined && model.capabilities.structuredOutput !== requirements.structuredOutput) return false;
  if (requirements.functionCalling !== undefined && model.capabilities.functionCalling !== requirements.functionCalling) return false;
  if (requirements.vision !== undefined && model.capabilities.vision !== requirements.vision) return false;
  if (requirements.embeddings !== undefined && model.capabilities.embeddings !== requirements.embeddings) return false;
  if (requirements.minContext !== undefined && model.contextWindow < requirements.minContext) return false;
  return true;
}

function toResolved(model: { id: string; providerId: string; name: string; contextWindow: number; capabilities: ResolvedAiModel['capabilities'] }): ResolvedAiModel {
  return {
    providerId: model.providerId,
    modelId: model.id,
    name: model.name,
    capabilities: model.capabilities,
    contextWindow: model.contextWindow,
  };
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
