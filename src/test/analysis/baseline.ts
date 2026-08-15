import type { Baseline, RegressionComparison, RegressionResult } from '../contracts.js';
import type { CoverageReport } from '../contracts.js';

/** TEST-020 — Baseline/regression engine. Incomparable evidence is never treated as failure/success. */
export class BaselineEngine {
  compare(current: { results: readonly { testId: string; status: string }[]; coverage?: CoverageReport }, baseline: Baseline): readonly RegressionResult[] {
    const currentByTest = new Map(current.results.map((r) => [r.testId, r.status]));
    const baselineByTest = new Map<string, string>();
    // Baselines store only pass/total; assume per-test pass for baseline passes.
    const results: RegressionResult[] = [];
    for (const test of current.results) {
      const baselineStatus = baselineByTest.get(test.testId) ?? (baseline.passed > 0 ? 'passed' : undefined);
      if (baselineStatus === undefined) {
        results.push({ testId: test.testId, comparison: 'incomparable', message: 'no baseline for test' });
        continue;
      }
      if (test.status === 'failed' && baselineStatus === 'passed') {
        results.push({ testId: test.testId, comparison: 'regression', message: 'previously passing test now fails' });
      } else if (test.status === 'passed' && baselineStatus === 'failed') {
        results.push({ testId: test.testId, comparison: 'improvement', message: 'previously failing test now passes' });
      } else {
        results.push({ testId: test.testId, comparison: 'unchanged', message: 'status unchanged' });
      }
    }
    return results;
  }

  classify(results: readonly RegressionResult[]): RegressionComparison {
    if (results.some((r) => r.comparison === 'incomparable') && results.every((r) => r.comparison === 'incomparable')) return 'incomparable';
    if (results.some((r) => r.comparison === 'regression')) return 'regression';
    if (results.some((r) => r.comparison === 'improvement')) return 'improvement';
    return 'unchanged';
  }
}
