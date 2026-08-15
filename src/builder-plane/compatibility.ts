import type { BuilderDefinition, BuilderContribution } from './contracts.js';

export interface CompatibilityChange {
  readonly kind: string;
  readonly path: string;
  readonly severity: 'breaking' | 'compatible' | 'info';
  readonly message: string;
}

export type Comparator<TSpec> = (candidate: TSpec, baseline: TSpec) => readonly CompatibilityChange[];

/**
 * BLD-X08 — generic compatibility analyzer. Modules supply domain-specific
 * comparators (API: removed endpoint = BREAKING; DB: removed column =
 * BREAKING; Agent: removed tool = WARNING; Workflow: removed stage =
 * BREAKING). Critical for Marketplace upgrades.
 */
export class BuilderCompatibilityAnalyzer<TSpec> {
  private readonly comparators = new Map<string, Comparator<TSpec>>();

  registerComparator(kind: string, comparator: Comparator<TSpec>): void {
    this.comparators.set(kind, comparator);
  }

  analyze(kind: string, candidate: TSpec, baseline: TSpec): { classification: 'compatible' | 'breaking'; changes: readonly CompatibilityChange[] } {
    const comparator = this.comparators.get(kind);
    if (!comparator) return { classification: 'compatible', changes: [] };
    const changes = comparator(candidate, baseline);
    const classification = changes.some((c) => c.severity === 'breaking') ? 'breaking' : 'compatible';
    return { classification, changes };
  }
}
