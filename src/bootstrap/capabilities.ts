import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerSystemCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.system',
    namespace: 'system',
    version: config.apiVersion,
    permissions: [],
    operations: ['system.status', 'system.health'],
  });
}
