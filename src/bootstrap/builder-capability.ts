import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerBuilderCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.builder',
    namespace: 'builder',
    version: config.apiVersion,
    permissions: ['builder.definitions.manage'],
    operations: [
      'builder.definition.create',
      'builder.definition.read',
      'builder.definition.update',
      'builder.definition.delete',
      'builder.definition.validate',
      'builder.definition.preview',
      'builder.definition.publish',
      'builder.definition.rollback',
      'builder.ai.generate',
      'builder.ai.modify',
      'builder.ai.review',
      'builder.ai.explain',
      'builder.ai.test',
      'builder.ai.document',
    ],
  });
}
