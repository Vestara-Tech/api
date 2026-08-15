/** AI2-016 — Budget/quota engine. Built on existing usage accounting. */

import { forbidden } from '../../core/errors.js';

export type BudgetScope = 'system' | 'organization' | 'user' | 'module' | 'agent' | 'workflow' | 'task' | 'session';

export interface BudgetLimit {
  readonly scope: BudgetScope;
  readonly scopeId: string;
  readonly dailyUsd?: number;
  readonly perRunUsd?: number;
  readonly tokenLimit?: number;
  readonly maxRequests?: number;
  readonly onThreshold: 'switch-profile' | 'warn';
  readonly thresholdRatio: number;
}

export interface BudgetUsage {
  readonly scope: BudgetScope;
  readonly scopeId: string;
  readonly usdToday: number;
  readonly tokensToday: number;
  readonly requestsToday: number;
  readonly usdThisRun: number;
  readonly thresholdMet: boolean;
  readonly hardLimitReached: boolean;
}

export interface BudgetStorePort {
  setLimit(limit: BudgetLimit): void;
  getLimits(scope: BudgetScope): readonly BudgetLimit[];
  addUsage(scope: BudgetScope, scopeId: string, usage: { usd: number; tokens: number; requests: number }): void;
  snapshot(scope: BudgetScope, scopeId: string): BudgetUsage;
}

export class InMemoryBudgetStore implements BudgetStorePort {
  private readonly limits = new Map<string, BudgetLimit>();
  private readonly usage = new Map<string, { usdToday: number; tokensToday: number; requestsToday: number; usdThisRun: number }>;

  setLimit(limit: BudgetLimit): void {
    this.limits.set(budgetKey(limit.scope, limit.scopeId), limit);
  }

  getLimits(scope: BudgetScope): readonly BudgetLimit[] {
    return [...this.limits.values()].filter((l) => l.scope === scope);
  }

  addUsage(scope: BudgetScope, scopeId: string, usage: { usd: number; tokens: number; requests: number }): void {
    const key = budgetKey(scope, scopeId);
    const current = this.usage.get(key) ?? { usdToday: 0, tokensToday: 0, requestsToday: 0, usdThisRun: 0 };
    this.usage.set(key, {
      usdToday: current.usdToday + usage.usd,
      tokensToday: current.tokensToday + usage.tokens,
      requestsToday: current.requestsToday + usage.requests,
      usdThisRun: current.usdThisRun + usage.usd,
    });
  }

  snapshot(scope: BudgetScope, scopeId: string): BudgetUsage {
    const usage = this.usage.get(budgetKey(scope, scopeId)) ?? { usdToday: 0, tokensToday: 0, requestsToday: 0, usdThisRun: 0 };
    const limit = this.limits.get(budgetKey(scope, scopeId));
    const thresholdMet = limit
      ? (limit.dailyUsd !== undefined && usage.usdToday >= limit.dailyUsd * limit.thresholdRatio) ||
        (limit.tokenLimit !== undefined && usage.tokensToday >= limit.tokenLimit * limit.thresholdRatio) ||
        (limit.maxRequests !== undefined && usage.requestsToday >= limit.maxRequests * limit.thresholdRatio)
      : false;
    const hardLimitReached = limit
      ? (limit.dailyUsd !== undefined && usage.usdToday >= limit.dailyUsd) ||
        (limit.tokenLimit !== undefined && usage.tokensToday >= limit.tokenLimit) ||
        (limit.maxRequests !== undefined && usage.requestsToday >= limit.maxRequests)
      : false;
    return {
      scope,
      scopeId,
      usdToday: usage.usdToday,
      tokensToday: usage.tokensToday,
      requestsToday: usage.requestsToday,
      usdThisRun: usage.usdThisRun,
      thresholdMet,
      hardLimitReached,
    };
  }
}

function budgetKey(scope: BudgetScope, scopeId: string): string {
  return `${scope}:${scopeId}`;
}

/** AI2-016 — Budget enforcement. On threshold -> switch-profile hint; on hard limit -> deny. */
export class BudgetEngine {
  private readonly store: BudgetStorePort;

  constructor(store: BudgetStorePort = new InMemoryBudgetStore()) {
    this.store = store;
  }

  setLimit(limit: BudgetLimit): void {
    this.store.setLimit(limit);
  }

  check(scope: BudgetScope, scopeId: string): BudgetUsage {
    return this.store.snapshot(scope, scopeId);
  }

  /** Deny when a hard limit is reached; hint profile switch on threshold. */
  authorize(scope: BudgetScope, scopeId: string): { allowed: boolean; usage: BudgetUsage; action?: 'switch-profile' | 'warn' } {
    const usage = this.store.snapshot(scope, scopeId);
    if (usage.hardLimitReached) throw forbidden(`AI budget hard limit reached for ${scope}:${scopeId}`);
    const limits = this.store.getLimits(scope);
    if (usage.thresholdMet && limits.some((l) => l.onThreshold === 'switch-profile')) {
      return { allowed: true, usage, action: 'switch-profile' };
    }
    return { allowed: true, usage };
  }

  record(scope: BudgetScope, scopeId: string, usage: { usd: number; tokens: number; requests: number }): void {
    this.store.addUsage(scope, scopeId, usage);
  }
}
