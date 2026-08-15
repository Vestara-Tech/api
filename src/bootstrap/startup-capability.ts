import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerStartupCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.startup',
    namespace: 'startup',
    version: config.apiVersion,
    permissions: ['startup.read', 'startup.progress', 'startup.service.update'],
    operations: ['startup.state.read', 'startup.progress.read', 'startup.services.read', 'startup.service.update', 'startup.transition'],
  });
}
