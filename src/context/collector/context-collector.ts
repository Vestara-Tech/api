import { randomId } from '../../core/identifiers.js';
import { createHash } from 'node:crypto';
import type {
  ContextBundle,
  ContextCollectionRequest,
  ContextItem,
  ContextProvenance,
  ContextScope,
} from '../domain/contracts.js';
import { CONTEXT_SCOPE_ORDER } from '../domain/contracts.js';
import { ContextProviderRegistry } from '../providers/context-provider-registry.js';
import { computeBudget, itemTokens } from '../budget/token-budget.js';

export interface ContextCollectorOptions {
  readonly registry: ContextProviderRegistry;
  /** Optional authorization gate: (principalId, item) => boolean. */
  readonly authorize?: (principalId: string, item: ContextItem) => boolean;
  /** Optional sensitivity gate for `sensitive` items. */
  readonly allowSensitive?: (principalId: string, item: ContextItem) => boolean;
  readonly defaultBudget?: { maximumTokens: number; reservedOutputTokens: number; reservedSystemTokens: number };
}

/**
 * CTX-005..011 — Context collector. Explicit pipeline:
 *
 *   discover sources → collect candidates → authorization filter →
 *   sensitivity filter → relevance ranking → deduplication → token budget →
 *   composition → ContextBundle
 *
 * Required items (agent instructions, task, permissions) always survive the
 * budget; they never depend on semantic retrieval.
 */
export class ContextCollector {
  private readonly registry: ContextProviderRegistry;
  private readonly authorize: NonNullable<ContextCollectorOptions['authorize']>;
  private readonly allowSensitive: NonNullable<ContextCollectorOptions['allowSensitive']>;
  private readonly defaultBudget: NonNullable<ContextCollectorOptions['defaultBudget']>;

  constructor(options: ContextCollectorOptions) {
    this.registry = options.registry;
    this.authorize = options.authorize ?? (() => true);
    this.allowSensitive = options.allowSensitive ?? (() => false);
    this.defaultBudget = options.defaultBudget ?? { maximumTokens: 128_000, reservedOutputTokens: 8_000, reservedSystemTokens: 8_000 };
  }

  async collect(request: ContextCollectionRequest): Promise<ContextBundle> {
    // Discover + collect candidates from all providers.
    const candidates = await this.collectCandidates(request);
    // Authorization: candidate accessible to context != agent may see it.
    const authorized = candidates.filter((item) => this.authorize(request.principalId, item));
    // Sensitivity filter.
    const allowed = authorized.filter((item) => !item.sensitive || this.allowSensitive(request.principalId, item));
    // Deduplicate by id/source.
    const unique = dedupe(allowed);
    // Rank by scope specificity + priority + relevance.
    const ranked = rank(unique, request.scope);
    // Budget: required items first, then best-ranked within the available budget.
    const budget = computeBudget({
      maximumTokens: request.maxTokens ?? this.defaultBudget.maximumTokens,
      reservedOutputTokens: this.defaultBudget.reservedOutputTokens,
      reservedSystemTokens: this.defaultBudget.reservedSystemTokens,
    });
    const selected = applyBudget(ranked, budget.availableContextTokens);

    const provenance: ContextProvenance[] = selected.map((item) => ({
      itemId: item.id,
      source: item.source,
      ...(item.sourceId !== undefined ? { sourceId: item.sourceId } : {}),
      scope: scopeOf(item),
    }));

    return {
      id: randomId('ctx'),
      purpose: request.purpose,
      items: selected,
      budget,
      provenance,
      createdAt: new Date().toISOString(),
    };
  }

  private async collectCandidates(request: ContextCollectionRequest): Promise<ContextItem[]> {
    const providers = this.registry.list();
    const results: ContextItem[] = [];
    for (const provider of providers) {
      try {
        results.push(...(await provider.collect(request)));
      } catch {
        // A failing provider must not break context assembly.
      }
    }
    return results;
  }
}

function scopeOf(item: ContextItem): ContextScope {
  const meta = item.metadata;
  const scope = meta.scope as ContextScope | undefined;
  return scope ?? 'run';
}

function rank(items: readonly ContextItem[], requestScope: ContextScope): ContextItem[] {
  const requestIndex = CONTEXT_SCOPE_ORDER.indexOf(requestScope);
  return [...items].sort((a, b) => {
    // Required first.
    if (a.required !== b.required) return a.required ? -1 : 1;
    // Closer to the request scope ranks higher.
    const aScope = CONTEXT_SCOPE_ORDER.indexOf(scopeOf(a));
    const bScope = CONTEXT_SCOPE_ORDER.indexOf(scopeOf(b));
    const aDist = Math.abs(aScope - requestIndex);
    const bDist = Math.abs(bScope - requestIndex);
    if (aDist !== bDist) return aDist - bDist;
    // Then priority, then relevance.
    if (a.priority !== b.priority) return b.priority - a.priority;
    return (b.relevance ?? 0) - (a.relevance ?? 0);
  });
}

function applyBudget(items: readonly ContextItem[], availableTokens: number): ContextItem[] {
  const required: ContextItem[] = [];
  const optional: ContextItem[] = [];
  for (const item of items) {
    if (item.required) required.push(item);
    else optional.push(item);
  }
  const selected = [...required];
  let used = required.reduce((sum, i) => sum + itemTokens(i), 0);
  for (const item of optional) {
    const tokens = itemTokens(item);
    if (used + tokens <= availableTokens) {
      selected.push(item);
      used += tokens;
    }
  }
  return selected;
}

function dedupe(items: readonly ContextItem[]): ContextItem[] {
  const seen = new Set<string>();
  const out: ContextItem[] = [];
  for (const item of items) {
    const key = `${item.source}:${item.sourceId ?? item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function bundleHash(bundle: ContextBundle): string {
  return createHash('sha256')
    .update(JSON.stringify(bundle.items.map((i) => ({ id: i.id, source: i.source, content: i.content }))))
    .digest('hex');
}
