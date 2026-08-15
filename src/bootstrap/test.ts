import { TestRunnerRegistry } from '../test/registry/test-runner-registry.js';
import { TestService } from '../test/service/test-service.js';
import { VitestAdapter } from '../test/adapters/vitest.js';
import { HttpTestAdapter } from '../test/adapters/http.js';

export interface TestPlatform {
  readonly registry: TestRunnerRegistry;
  readonly service: TestService;
}

/** TEST — Composition root. Registers Vitest + HTTP/API adapters. */
export function buildTestPlatform(): TestPlatform {
  const registry = new TestRunnerRegistry();
  registry.register(new VitestAdapter());
  registry.register(new HttpTestAdapter());
  const service = new TestService({ registry });
  return { registry, service };
}
