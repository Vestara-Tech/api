import type { FlakinessResult, TestHistoryEntry } from '../contracts.js';

/**
 * TEST-019 — Flaky-test analyzer. Uses full attempt history — a retry that
 * passes never erases the original failure.
 */
export class FlakinessAnalyzer {
  analyze(history: readonly TestHistoryEntry[]): FlakinessResult | undefined {
    const byTest = new Map<string, TestHistoryEntry[]>();
    for (const entry of history) {
      const list = byTest.get(entry.testId) ?? [];
      list.push(entry);
      byTest.set(entry.testId, list);
    }
    const testId = history[0]?.testId;
    if (!testId) return undefined;
    const runs = byTest.get(testId) ?? [];
    const passed = runs.filter((r) => r.status === 'passed').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    const retried = 0;
    const flakiness = runs.length > 0 ? Math.round((failed / runs.length) * 100) : 0;
    const confidence: FlakinessResult['confidence'] = runs.length >= 20 ? 'high' : runs.length >= 8 ? 'medium' : 'low';
    return {
      testId,
      runs: runs.length,
      passed,
      failed,
      retried,
      flakiness,
      confidence,
      classification: flakiness > 20 ? 'Likely timing-sensitive' : flakiness > 0 ? 'Intermittent' : 'Stable',
    };
  }
}
