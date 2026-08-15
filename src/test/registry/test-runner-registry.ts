import { conflict, notFound } from '../../core/errors.js';
import type { TestRunner } from '../runner/runner.js';
import type { TestType } from '../contracts.js';

/** TEST-007 — Runner registry. Testing libraries are adapters, never concepts. */
export class TestRunnerRegistry {
  private readonly runners = new Map<string, TestRunner>();

  register(runner: TestRunner): void {
    if (this.runners.has(runner.id)) throw conflict(`Test runner "${runner.id}" already registered`);
    this.runners.set(runner.id, runner);
  }

  resolveFor(type: TestType): TestRunner {
    for (const runner of this.list()) {
      if (runner.capabilities.some((c) => c === type)) return runner;
    }
    throw notFound(`No test runner supports type "${type}"`);
  }

  get(id: string): TestRunner {
    const runner = this.runners.get(id);
    if (!runner) throw notFound(`Test runner "${id}" not found`);
    return runner;
  }

  list(): readonly TestRunner[] {
    return [...this.runners.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
