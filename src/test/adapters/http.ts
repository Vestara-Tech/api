import type { TestDiscoveryContext, TestDiscoveryResult, TestExecutionPlan, TestExecutionRequest, TestExecutionResult, TestRunner, TestRunnerCapability } from '../runner/runner.js';

/**
 * TEST-009 — HTTP/API test adapter. Deterministic: each test carries a
 * { method, path, expectedStatus } request; the adapter verifies the status.
 */
export class HttpTestAdapter implements TestRunner {
  readonly id = 'http';
  readonly capabilities: readonly TestRunnerCapability[] = ['api', 'contract'];

  async discover(context: TestDiscoveryContext): Promise<TestDiscoveryResult> {
    return { target: context.target, frameworks: ['http'], suites: 1, tests: 0, capabilities: [...this.capabilities] as never };
  }

  async plan(request: TestExecutionRequest): Promise<TestExecutionPlan> {
    return { request, tests: request.suite.tests.map((t) => t.id) };
  }

  async execute(plan: TestExecutionPlan): Promise<TestExecutionResult> {
    const base = String(plan.request.environment ?? plan.request.apiBase ?? 'http://localhost:4310');
    const results: TestExecutionResult['results'][number][] = [];
    for (const test of plan.request.suite.tests) {
      const req = test.parameters as { method?: string; path?: string; expectedStatus?: number };
      const method = req.method ?? 'GET';
      const path = req.path ?? '/';
      const expected = req.expectedStatus ?? 200;
      try {
        const response = await fetch(`${base}${path}`, { method });
        const ok = response.status === expected;
        results.push({ testId: test.id, status: ok ? 'passed' : 'failed', durationMs: 1, attempt: 1, ...(!ok ? { error: `expected ${expected}, got ${response.status}` } : {}) });
      } catch {
        results.push({ testId: test.id, status: 'failed', durationMs: 1, attempt: 1, error: 'request failed (API unreachable)' });
      }
    }
    return { results };
  }

  async cancel(_executionId: string): Promise<void> {}
}
