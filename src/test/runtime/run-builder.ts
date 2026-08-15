import { createHash } from 'node:crypto';
import { randomId } from '../../core/identifiers.js';
import type { NormalizedTestCaseResult, TestEvidenceBundle, TestRun } from '../contracts.js';

/** TEST-016 — normalize runner output into TestRun. */
export function buildTestRun(input: {
  planId: string;
  profileId: string;
  target: string;
  results: readonly NormalizedTestCaseResult[];
  coverage?: TestRun['coverage'];
  artifacts?: readonly string[];
  logs?: readonly string[];
}): TestRun {
  const total = input.results.length;
  const passed = input.results.filter((r) => r.status === 'passed').length;
  const failed = input.results.filter((r) => r.status === 'failed' || r.status === 'timed_out').length;
  const skipped = input.results.filter((r) => r.status === 'skipped').length;
  const startedAt = new Date().toISOString();
  return {
    id: randomId('test'),
    planId: input.planId,
    profileId: input.profileId,
    target: input.target,
    status: 'finalized',
    executions: input.results.map((r) => ({ executionId: randomId('exec'), testId: r.testId, status: r.status, startedAt, attempt: r.attempt })),
    results: input.results,
    summary: { total, passed, failed, skipped },
    ...(input.coverage !== undefined ? { coverage: input.coverage } : {}),
    artifacts: input.artifacts ?? [],
    logs: input.logs ?? [],
    evidenceId: randomId('evid'),
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

export function hashResults(results: readonly NormalizedTestCaseResult[]): string {
  return createHash('sha256').update(JSON.stringify(results.map((r) => ({ id: r.testId, status: r.status, error: r.error })))).digest('hex');
}

/** TEST-023 — immutable evidence bundle. */
export function buildEvidenceBundle(input: {
  definitionHash: string;
  planHash: string;
  sourceRevision: string;
  environment: string;
  run: TestRun;
}): TestEvidenceBundle {
  const evidenceHash = createHash('sha256')
    .update(JSON.stringify({ definitionHash: input.definitionHash, planHash: input.planHash, results: input.run.results.map((r) => r.testId + r.status) }))
    .digest('hex');
  const bundle: TestEvidenceBundle = {
    definitionHash: input.definitionHash,
    planHash: input.planHash,
    sourceRevision: input.sourceRevision,
    environment: input.environment,
    startedAt: input.run.startedAt ?? '',
    completedAt: input.run.completedAt ?? '',
    results: input.run.results,
    ...(input.run.coverage !== undefined ? { coverage: input.run.coverage } : {}),
    artifacts: input.run.artifacts,
    logs: input.run.logs,
    evidenceHash,
  };
  return bundle;
}
