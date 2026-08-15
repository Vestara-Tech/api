import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerGeneratorCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.generator',
    namespace: 'generator',
    version: config.apiVersion,
    permissions: ['generator.run', 'generator.plan', 'generator.discover', 'generator.apply'],
    operations: [
      'generator.list',
      'generator.discover',
      'generator.plan',
      'generator.run',
      'generator.preview',
      'generator.apply',
      'generator.compatibility',
    ],
  });
}
