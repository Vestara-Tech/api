import type { ContextBudget, ContextItem } from '../domain/contracts.js';

export interface TokenBudgetOptions {
  readonly maximumTokens: number;
  readonly reservedOutputTokens: number;
  readonly reservedSystemTokens: number;
}

/** Rough token estimate: ~4 chars per token. */
export function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

export function itemTokens(item: ContextItem): number {
  return item.tokenEstimate ?? estimateTokens(item.content);
}

export function computeBudget(options: TokenBudgetOptions): ContextBudget {
  const availableContextTokens = Math.max(0, options.maximumTokens - options.reservedOutputTokens - options.reservedSystemTokens);
  return {
    maximumTokens: options.maximumTokens,
    reservedOutputTokens: options.reservedOutputTokens,
    reservedSystemTokens: options.reservedSystemTokens,
    availableContextTokens,
  };
}
