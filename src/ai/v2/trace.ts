/** AI2-018/019 — AI tracing + evidence. */

import { randomId } from '../../core/identifiers.js';
import { hashOf } from '../../generator/domain/hash.js';

export interface AiTraceStep {
  readonly name: string;
  readonly durationMs: number;
  readonly detail?: string;
}

export interface AiTrace {
  readonly traceId: string;
  readonly requestId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly steps: readonly AiTraceStep[];
  readonly totalMs: number;
  readonly at: string;
}

export interface AiEvidence {
  readonly evidenceId: string;
  readonly requestId: string;
  readonly profileId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly routing: {
    readonly strategy: string;
    readonly selectedFrom: string;
    readonly reason: string;
  };
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number; readonly estimatedCostUsd: number };
  readonly traceId: string;
  readonly evidenceHash: string;
  readonly at: string;
}

export interface TraceStorePort {
  save(trace: AiTrace): void;
  get(traceId: string): AiTrace | undefined;
  list(): readonly AiTrace[];
}

export class InMemoryTraceStore implements TraceStorePort {
  private readonly traces = new Map<string, AiTrace>();

  save(trace: AiTrace): void {
    this.traces.set(trace.traceId, trace);
  }

  get(traceId: string): AiTrace | undefined {
    return this.traces.get(traceId);
  }

  list(): readonly AiTrace[] {
    return [...this.traces.values()].sort((a, b) => b.at.localeCompare(a.at));
  }
}

/** AI2-018 — AI tracer. Records the request pipeline steps. */
export class AiTracer {
  private readonly store: TraceStorePort;

  constructor(store: TraceStorePort = new InMemoryTraceStore()) {
    this.store = store;
  }

  begin(requestId: string, providerId: string, modelId: string): AiTrace {
    const trace: AiTrace = { traceId: randomId('trace'), requestId, providerId, modelId, steps: [], totalMs: 0, at: new Date().toISOString() };
    this.store.save(trace);
    return trace;
  }

  step(traceId: string, name: string, durationMs: number, detail?: string): AiTrace {
    const trace = this.store.get(traceId);
    if (!trace) throw new Error(`Trace "${traceId}" not found`);
    const steps = [...trace.steps, { name, durationMs, ...(detail !== undefined ? { detail } : {}) }];
    const next: AiTrace = { ...trace, steps, totalMs: steps.reduce((s, step) => s + step.durationMs, 0) };
    this.store.save(next);
    return next;
  }

  get(traceId: string): AiTrace | undefined {
    return this.store.get(traceId);
  }

  list(): readonly AiTrace[] {
    return this.store.list();
  }
}

/** AI2-019 — AI evidence. Every request produces provenance. */
export function buildAiEvidence(input: {
  requestId: string;
  profileId: string;
  providerId: string;
  modelId: string;
  routing: { strategy: string; selectedFrom: string; reason: string };
  usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  traceId: string;
}): AiEvidence {
  const evidence: AiEvidence = {
    evidenceId: randomId('evid'),
    requestId: input.requestId,
    profileId: input.profileId,
    providerId: input.providerId,
    modelId: input.modelId,
    routing: input.routing,
    usage: input.usage,
    traceId: input.traceId,
    evidenceHash: hashOf({
      requestId: input.requestId,
      profileId: input.profileId,
      providerId: input.providerId,
      modelId: input.modelId,
      routing: input.routing,
      usage: input.usage,
      traceId: input.traceId,
    }),
    at: new Date().toISOString(),
  };
  return evidence;
}
