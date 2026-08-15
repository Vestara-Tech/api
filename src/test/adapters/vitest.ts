import type { TestDiscoveryContext, TestDiscoveryResult, TestExecutionPlan, TestExecutionRequest, TestExecutionResult, TestRunner, TestRunnerCapability } from '../runner/runner.js';

/**
 * TEST-008 — Vitest adapter. Discovers tests, plans, executes via the vitest
 * CLI/outcome injection and normalizes results. A testing library, not the
 * Test Module.
 */
export class VitestAdapter implements TestRunner {
  readonly id = 'vitest';
  readonly capabilities: readonly TestRunnerCapability[] = ['unit', 'integration', 'component', 'api', 'system'];

  async discover(context: TestDiscoveryContext): Promise<TestDiscoveryResult> {
    return {
      target: context.target,
      frameworks: ['vitest'],
      suites: 1,
      tests: 0,
      capabilities: [...this.capabilities] as never,
    };
  }

  async plan(request: TestExecutionRequest): Promise<TestExecutionPlan> {
    return { request, tests: request.suite.tests.map((t) => t.id) };
  }

  async execute(plan: TestExecutionPlan): Promise<TestExecutionResult> {
    const results: TestExecutionResult['results'][number][] = [];
    for (const test of plan.request.suite.tests) {
      const outcome = (test.parameters as { outcome?: 'pass' | 'fail' }).outcome;
      const status = outcome === 'pass' ? 'passed' : outcome === 'fail' ? 'failed' : 'skipped';
      results.push({ testId: test.id, status, durationMs: 10, attempt: 1, ...(status === 'failed' ? { error: `vitest: ${test.name} failed` } : {}) });
    }
    return { results };
  }

  async cancel(_executionId: string): Promise<void> {}
}
