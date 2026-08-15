import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerConfigCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.config',
    namespace: 'config',
    version: config.apiVersion,
    permissions: ['config.read', 'config.write', 'config.validate', 'config.resolve', 'config.watch', 'config.history', 'config.rollback', 'config.schema.register'],
    operations: [
      'config.schema.list',
      'config.resolve',
      'config.draft.create',
      'config.draft.validate',
      'config.draft.apply',
      'config.scope.rollback',
      'config.scope.revisions',
    ],
  });
}
