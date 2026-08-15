import { randomId } from '../../core/identifiers.js';
import type { TestDefinition, TestKind, TestRunner, TestRun, TestSuite } from '../contracts.js';
import { TestRunnerRegistry } from '../registry/test-runner-registry.js';
import { buildTestRun } from '../runtime/run-builder.js';

export interface TestServiceOptions {
  readonly registry: TestRunnerRegistry;
}

/**
 * TEST — Test service facade. Modules contribute suites; the registry selects
 * a runner by kind. Test exercises expected behavior; Verifier evaluates
 * evidence separately.
 */
export class TestService {
  private readonly registry: TestRunnerRegistry;
  private readonly suites = new Map<string, TestSuite>();

  constructor(options: TestServiceOptions) {
    this.registry = options.registry;
  }

  createSuite(input: { id: string; name: string; tests: readonly TestDefinition[] }): TestSuite {
    const suite: TestSuite = { id: input.id, name: input.name, tests: input.tests, createdAt: new Date().toISOString() };
    this.suites.set(suite.id, suite);
    return suite;
  }

  getSuite(id: string): TestSuite {
    const suite = this.suites.get(id);
    if (!suite) throw new Error(`Test suite "${id}" not found`);
    return suite;
  }

  listSuites(): readonly TestSuite[] {
    return [...this.suites.values()];
  }

  async run(suiteId: string, env: Record<string, unknown> = {}): Promise<ReturnType<TestRunner['run']>> {
    const suite = this.getSuite(suiteId);
    // Group by kind; resolve a runner for each and execute.
    const results: (TestRun['results'][number])[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let runnerUsed = '';

    for (const kind of distinctKinds(suite)) {
      const runner = this.registry.resolveFor(kind);
      runnerUsed = runner.id;
      const kindSuite: TestSuite = { ...suite, id: suite.id, tests: suite.tests.filter((t) => t.kind === kind) };
      const run = await runner.run(kindSuite, { runId: randomId('tr'), env });
      results.push(...run.results);
      passed += run.passed;
      failed += run.failed;
      skipped += run.skipped;
    }
    return buildTestRun({ suite, runner: runnerUsed, status: failed > 0 ? 'failed' : 'completed', total: suite.tests.length, passed, failed, skipped, results });
  }
}

function distinctKinds(suite: TestSuite): TestKind[] {
  return [...new Set(suite.tests.map((t) => t.kind))];
}
