import type { AiModelPricing, AiUsage } from '../domain/contracts.js';

/**
 * AI-020 — Cost estimation. Uses catalog pricing (from models.dev metadata)
 * to estimate USD cost of a usage record. All prices are per million tokens.
 */
export class CostEstimator {
  estimate(pricing: AiModelPricing | undefined, usage: AiUsage): number | undefined {
    if (!pricing) return undefined;
    const inputPerMillion = pricing.inputPerMillion ?? 0;
    const outputPerMillion = pricing.outputPerMillion ?? 0;
    const cacheReadPerMillion = pricing.cacheReadPerMillion;

    const inputTokens = usage.inputTokens;
    const cachedTokens = usage.cachedTokens ?? 0;
    const uncachedInput = Math.max(0, inputTokens - cachedTokens);

    let cost = (uncachedInput / 1_000_000) * inputPerMillion + (usage.outputTokens / 1_000_000) * outputPerMillion;
    if (cacheReadPerMillion !== undefined && cachedTokens > 0) {
      cost += (cachedTokens / 1_000_000) * cacheReadPerMillion;
    }
    return roundUsd(cost);
  }
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
