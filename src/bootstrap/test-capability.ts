import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerTestCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.tests',
    namespace: 'tests',
    version: config.apiVersion,
    permissions: ['test.read', 'test.run', 'test.evidence'],
    operations: ['tests.suites.list', 'tests.suite.create', 'tests.run', 'tests.runners.list'],
  });
}
