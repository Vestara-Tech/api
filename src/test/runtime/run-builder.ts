import { createHash } from 'node:crypto';
import { randomId } from '../../core/identifiers.js';
import type { TestRun, TestRunStatus, TestSuite } from '../contracts.js';

export function buildTestRun(input: { suite: TestSuite; runner: string; status: TestRunStatus; total: number; passed: number; failed: number; skipped: number; results: TestRun['results'] }): TestRun {
  return {
    id: randomId('test'),
    suiteId: input.suite.id,
    status: input.status,
    startedAt: new Date().toISOString(),
    total: input.total,
    passed: input.passed,
    failed: input.failed,
    skipped: input.skipped,
    results: input.results,
    evidenceHash: hashResults(input.results),
    runner: input.runner,
  };
}

export function hashResults(results: TestRun['results']): string {
  return createHash('sha256')
    .update(JSON.stringify(results.map((r) => ({ id: r.testId, status: r.status, error: r.error }))))
    .digest('hex');
}
