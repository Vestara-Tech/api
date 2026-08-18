import type { ExecutionContextItem, ContextSelectionMetadata } from './execution-context.js';

/** DEX-CP2 CTX-008 — Context selection and budgeting policy. */
export interface ContextSelectionPolicy {
  readonly budgetTokens: number;
}

/** DEX-CP2 CTX-008 — Result of context selection. */
export interface ContextSelectionResult {
  readonly selected: readonly ExecutionContextItem[];
  readonly dropped: readonly string[];
  readonly requiredDropped: readonly string[];
  readonly metadata: ContextSelectionMetadata;
}

/**
 * DEX-CP2 CTX-008 — Context selector. Applies priority-based selection
 * with a token budget. Required items are never silently dropped.
 *
 * Selection order:
 *   1. All required items are included first (sorted by priority desc, then id).
 *   2. Optional items are included in priority order until budget is exhausted.
 *   3. If required items exceed budget, they are still included and recorded
 *      in requiredDropped (the caller must handle this — never silently drop).
 */
export function selectContext(
  items: readonly ExecutionContextItem[],
  policy: ContextSelectionPolicy,
): ContextSelectionResult {
  const required = items
    .filter((i) => i.required)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const optional = items
    .filter((i) => !i.required)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const selected: ExecutionContextItem[] = [];
  const dropped: string[] = [];
  const requiredDropped: string[] = [];
  let usedTokens = 0;

  // Phase 1: Include all required items, tracking overflow.
  for (const item of required) {
    if (usedTokens + item.estimatedTokens <= policy.budgetTokens) {
      selected.push(item);
      usedTokens += item.estimatedTokens;
    } else {
      // Required item exceeds budget — still include it, but record the overflow.
      selected.push(item);
      usedTokens += item.estimatedTokens;
      requiredDropped.push(item.id);
    }
  }

  // Phase 2: Include optional items within remaining budget.
  for (const item of optional) {
    if (usedTokens + item.estimatedTokens <= policy.budgetTokens) {
      selected.push(item);
      usedTokens += item.estimatedTokens;
    } else {
      dropped.push(item.id);
    }
  }

  const metadata: ContextSelectionMetadata = {
    totalItems: items.length,
    selectedItems: selected.length,
    totalEstimatedTokens: usedTokens,
    budgetTokens: policy.budgetTokens,
    droppedItems: dropped,
    requiredDropped,
    resolvedAt: new Date().toISOString(),
  };

  return { selected, dropped, requiredDropped, metadata };
}
