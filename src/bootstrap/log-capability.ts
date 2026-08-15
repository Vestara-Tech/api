import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerLogCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.logs',
    namespace: 'logs',
    version: config.apiVersion,
    permissions: ['log.read', 'log.write', 'log.export'],
    operations: ['logs.query', 'logs.tail', 'logs.stats', 'logs.sources', 'logs.emit'],
  });
}
