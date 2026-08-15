import type { AiUsageRecord } from '../domain/contracts.js';

export interface AiBudget {
  readonly consumerId: string;
  readonly dailyCostUsd?: number;
  readonly dailyInputTokens?: number;
  readonly dailyOutputTokens?: number;
}

export interface BudgetDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * AI-021 — Budget policy. Enforces per-consumer budgets over recorded usage:
 * daily cost and/or daily token caps. Prevents unbounded AI spend without
 * blocking reads or provisioning.
 */
export class BudgetPolicy {
  private readonly budgets = new Map<string, AiBudget>();

  setBudget(budget: AiBudget): void {
    this.budgets.set(budget.consumerId, budget);
  }

  removeBudget(consumerId: string): void {
    this.budgets.delete(consumerId);
  }

  getBudget(consumerId: string): AiBudget | undefined {
    return this.budgets.get(consumerId);
  }

  /** Evaluate the budget against all recorded usage for a consumer (today). */
  check(consumerId: string, records: readonly AiUsageRecord[]): BudgetDecision {
    const budget = this.budgets.get(consumerId);
    if (!budget) return { allowed: true, reason: 'no budget configured' };

    const today = new Date().toISOString().slice(0, 10);
    const todays = records.filter((r) => r.consumerId === consumerId && r.startedAt.startsWith(today));

    const cost = todays.reduce((sum, r) => sum + (r.estimatedCostUsd ?? 0), 0);
    const input = todays.reduce((sum, r) => sum + r.inputTokens, 0);
    const output = todays.reduce((sum, r) => sum + r.outputTokens, 0);

    if (budget.dailyCostUsd !== undefined && cost >= budget.dailyCostUsd) {
      return {
        allowed: false,
        reason: `consumer "${consumerId}" reached daily cost budget $${budget.dailyCostUsd} (spent $${cost.toFixed(4)})`,
      };
    }
    if (budget.dailyInputTokens !== undefined && input >= budget.dailyInputTokens) {
      return { allowed: false, reason: `consumer "${consumerId}" reached daily input token budget ${budget.dailyInputTokens}` };
    }
    if (budget.dailyOutputTokens !== undefined && output >= budget.dailyOutputTokens) {
      return { allowed: false, reason: `consumer "${consumerId}" reached daily output token budget ${budget.dailyOutputTokens}` };
    }
    return { allowed: true, reason: 'within budget' };
  }
}
