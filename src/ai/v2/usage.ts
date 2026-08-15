/** AI2-017 — Usage aggregation. */

import type { AiUsageRecord } from '../domain/contracts.js';

export interface UsageAggregation {
  readonly requests: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens: number;
  readonly costUsd: number;
  readonly successRate: number;
  readonly p95LatencyMs: number;
  readonly fallbacks: number;
  readonly errors: number;
}

export interface UsageGrouping {
  readonly groupBy: 'provider' | 'model' | 'module' | 'agent' | 'user';
  readonly groups: readonly { key: string; requests: number; tokens: number; costUsd: number }[];
}

export interface UsageStorePort {
  record(record: AiUsageRecord): void;
  list(): readonly AiUsageRecord[];
}

export class InMemoryUsageStore implements UsageStorePort {
  private readonly records: AiUsageRecord[] = [];

  record(record: AiUsageRecord): void {
    this.records.push(record);
  }

  list(): readonly AiUsageRecord[] {
    return [...this.records];
  }
}

/** AI2-017 — Usage aggregation over records. */
export class UsageAggregator {
  private readonly store: UsageStorePort;

  constructor(store: UsageStorePort = new InMemoryUsageStore()) {
    this.store = store;
  }

  record(record: AiUsageRecord): void {
    this.store.record(record);
  }

  aggregate(): UsageAggregation {
    const records = this.store.list();
    if (records.length === 0) return { requests: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUsd: 0, successRate: 0, p95LatencyMs: 0, fallbacks: 0, errors: 0 };
    const latencies = records.map((r) => r.latencyMs).sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
    return {
      requests: records.length,
      inputTokens: records.reduce((s, r) => s + r.inputTokens, 0),
      outputTokens: records.reduce((s, r) => s + r.outputTokens, 0),
      cachedTokens: records.reduce((s, r) => s + (r.cachedTokens ?? 0), 0),
      costUsd: records.reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0),
      successRate: 1,
      p95LatencyMs: p95,
      fallbacks: records.reduce((s, r) => s + r.fallbackCount, 0),
      errors: 0,
    };
  }

  groupBy(groupBy: UsageGrouping['groupBy']): UsageGrouping {
    const records = this.store.list();
    const map = new Map<string, { requests: number; tokens: number; costUsd: number }>();
    for (const record of records) {
      const key = groupBy === 'provider' ? record.providerId : groupBy === 'model' ? record.modelId : groupBy === 'module' || groupBy === 'agent' || groupBy === 'user' ? record.consumerId : record.consumerId;
      const current = map.get(key) ?? { requests: 0, tokens: 0, costUsd: 0 };
      map.set(key, {
        requests: current.requests + 1,
        tokens: current.tokens + record.inputTokens + record.outputTokens,
        costUsd: current.costUsd + (record.estimatedCostUsd ?? 0),
      });
    }
    return {
      groupBy,
      groups: [...map.entries()].sort((a, b) => b[1].costUsd - a[1].costUsd).map(([key, value]) => ({ key, ...value })),
    };
  }
}
