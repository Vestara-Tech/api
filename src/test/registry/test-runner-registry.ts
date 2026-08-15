import { conflict, notFound } from '../../core/errors.js';
import type { TestKind, TestRunner, TestRunnerContribution } from '../contracts.js';

/**
 * TEST-006 — TestRunnerRegistry. Modules request capabilities; testing
 * libraries are adapters, never architectural concepts.
 */
export class TestRunnerRegistry {
  private readonly contributions = new Map<string, TestRunnerContribution>();

  register(contribution: TestRunnerContribution): void {
    if (this.contributions.has(contribution.id)) throw conflict(`Test runner "${contribution.id}" already registered`);
    this.contributions.set(contribution.id, contribution);
  }

  resolveFor(kind: TestKind): TestRunner {
    for (const contribution of this.list()) {
      if (contribution.supportedKinds.includes(kind)) return contribution.createRunner();
    }
    throw notFound(`No test runner supports kind "${kind}"`);
  }

  list(): readonly TestRunnerContribution[] {
    return [...this.contributions.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
