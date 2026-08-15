import type { AiService } from '../runtime/ai-runtime.js';
import type { AiGenerateRequest, AiGenerateResult } from '../domain/contracts.js';
import type { AiPlatformV2 } from './ai-platform-v2.js';
import { AiSessionManager } from './session.js';
import { BudgetEngine, type BudgetScope } from './budget.js';
import { UsageAggregator } from './usage.js';
import { AiTracer, buildAiEvidence } from './trace.js';

export interface AiRuntimeV2Options {
  readonly service: AiService;
  readonly platform: AiPlatformV2;
  readonly sessions?: AiSessionManager;
  readonly budgets?: BudgetEngine;
  readonly usage?: UsageAggregator;
  readonly tracer?: AiTracer;
}

export interface AiExecutionRecord {
  readonly requestId: string;
  readonly traceId: string;
  readonly evidenceHash: string;
  readonly result: AiGenerateResult;
}

/**
 * AI2-011..019 — AI runtime v2. Executes a generate request through the
 * profile-driven router, budget engine, session runtime, usage accounting,
 * tracing and evidence. One governed execution path for every module.
 */
export class AiRuntimeV2 {
  private readonly service: AiService;
  private readonly platform: AiPlatformV2;
  private readonly sessions: AiSessionManager;
  private readonly budgets: BudgetEngine;
  private readonly usage: UsageAggregator;
  private readonly tracer: AiTracer;

  constructor(options: AiRuntimeV2Options) {
    this.service = options.service;
    this.platform = options.platform;
    this.sessions = options.sessions ?? new AiSessionManager();
    this.budgets = options.budgets ?? new BudgetEngine();
    this.usage = options.usage ?? new UsageAggregator();
    this.tracer = options.tracer ?? new AiTracer();
  }

  async execute(request: AiGenerateRequest & { profileId: string; sessionId?: string; budget?: { scope: BudgetScope; scopeId: string } }): Promise<AiExecutionRecord> {
    const profile = this.platform.profiles.get(request.profileId);
    if (!profile) throw new Error(`AI profile "${request.profileId}" not found`);

    // Budget check.
    if (request.budget) this.budgets.authorize(request.budget.scope, request.budget.scopeId);

    // Explainable routing.
    const decision = this.platform.router.route(profile);
    const requestId = `req_${Date.now()}`;
    const trace = this.tracer.begin(requestId, decision.resolved.providerId, decision.resolved.modelId);

    const result = await this.service.generate({
      ...request,
      model: { provider: decision.resolved.providerId, model: decision.resolved.modelId },
      ...(profile.parameters.temperature !== undefined ? { temperature: profile.parameters.temperature } : {}),
      ...(profile.parameters.maxTokens !== undefined ? { maxTokens: profile.parameters.maxTokens } : {}),
      ...(profile.budget?.maxTokensPerRequest !== undefined ? { maxTokens: profile.budget.maxTokensPerRequest } : {}),
    });

    this.tracer.step(trace.traceId, 'model.request', result.latencyMs, `${decision.resolved.providerId}/${decision.resolved.modelId}`);

    // Usage accounting + budget.
    const usageRecord = {
      requestId,
      consumerId: request.consumer.id,
      providerId: result.providerId,
      modelId: result.modelId,
      latencyMs: result.latencyMs,
      startedAt: trace.at,
      completedAt: new Date().toISOString(),
      fallbackCount: result.fallbackCount,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      ...(result.usage.cachedTokens !== undefined ? { cachedTokens: result.usage.cachedTokens } : {}),
      ...(result.usage.estimatedCostUsd !== undefined ? { estimatedCostUsd: result.usage.estimatedCostUsd } : {}),
    };
    this.usage.record(usageRecord);

    const costUsd = result.usage.estimatedCostUsd ?? 0;
    if (request.budget) {
      this.budgets.record(request.budget.scope, request.budget.scopeId, { usd: costUsd, tokens: result.usage.inputTokens + result.usage.outputTokens, requests: 1 });
    }

    // Session runtime.
    if (request.sessionId) {
      this.sessions.recordUsage(request.sessionId, { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, estimatedCostUsd: costUsd }, decision);
    }

    // Evidence.
    const evidence = buildAiEvidence({
      requestId,
      profileId: request.profileId,
      providerId: result.providerId,
      modelId: result.modelId,
      routing: { strategy: decision.strategy, selectedFrom: decision.selectedFrom, reason: decision.reason },
      usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, estimatedCostUsd: costUsd },
      traceId: trace.traceId,
    });

    return { requestId, traceId: trace.traceId, evidenceHash: evidence.evidenceHash, result };
  }
}
