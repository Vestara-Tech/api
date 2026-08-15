import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerContextCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.context',
    namespace: 'context',
    version: config.apiVersion,
    permissions: ['context.read', 'context.provide', 'context.snapshot'],
    operations: ['context.collect', 'context.providers.list', 'context.snapshots.list'],
  });
}
