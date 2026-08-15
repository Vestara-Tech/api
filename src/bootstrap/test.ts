import { TestRunnerRegistry } from '../test/registry/test-runner-registry.js';
import { TestService } from '../test/service/test-service.js';
import { VitestAdapter } from '../test/adapters/vitest.js';
import { HttpTestAdapter } from '../test/adapters/http.js';

export interface TestPlatformOptions {
  readonly register?: boolean;
}

export interface TestPlatform {
  readonly registry: TestRunnerRegistry;
  readonly service: TestService;
}

/** TEST — Composition root. Registers Vitest + HTTP/API adapters. */
export function buildTestPlatform(_options: TestPlatformOptions = {}): TestPlatform {
  const registry = new TestRunnerRegistry();
  registry.register({ id: 'vitest', moduleId: 'test', version: '1.0.0', supportedKinds: ['unit', 'integration', 'component', 'e2e', 'visual', 'regression'], capabilities: ['test.unit.run'], createRunner: () => new VitestAdapter() });
  registry.register({ id: 'http', moduleId: 'test', version: '1.0.0', supportedKinds: ['api', 'contract', 'smoke'], capabilities: ['test.api.run'], createRunner: () => new HttpTestAdapter() });
  const service = new TestService({ registry });
  return { registry, service };
}
