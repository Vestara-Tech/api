import type { TestRunner, TestRunnerContext, TestSuite, TestKind, TestRun } from '../contracts.js';
import { buildTestRun } from '../runtime/run-builder.js';

/**
 * TEST-009 — HTTP/API test adapter. Executes `api`/`contract` tests: each test
 * carries a request { method, url, status } and the adapter verifies the HTTP
 * status code. Deterministic, no LLM.
 */
export class HttpTestAdapter implements TestRunner {
  readonly id = 'http';
  readonly supportedKinds: readonly TestKind[] = ['api', 'contract', 'smoke'];

  async run(suite: TestSuite, context: TestRunnerContext): Promise<ReturnType<typeof buildTestRun>> {
    const base = String(context.env.API_BASE ?? 'http://localhost:4310');
    const results: (TestRun['results'][number])[] = [];
    let passed = 0;
    let failed = 0;

    for (const test of suite.tests) {
      const req = test.configuration as { method?: string; path?: string; status?: number; expectedStatus?: number };
      const method = req.method ?? 'GET';
      const path = req.path ?? '/';
      const expected = req.expectedStatus ?? req.status ?? 200;
      const started = Date.now();
      try {
        const response = await fetch(`${base}${path}`, { method });
        const ok = response.status === expected;
        if (ok) passed += 1;
        else failed += 1;
        results.push({
          testId: test.id,
          name: test.name,
          status: ok ? 'passed' : 'failed',
          durationMs: Date.now() - started,
          ...(!ok ? { error: `expected ${expected}, got ${response.status}` } : {}),
        });
      } catch (err) {
        failed += 1;
        results.push({ testId: test.id, name: test.name, status: 'error', error: (err as Error).message });
      }
    }
    return buildTestRun({ suite, runner: 'http', status: failed > 0 ? 'failed' : 'completed', total: suite.tests.length, passed, failed, skipped: 0, results });
  }
}
