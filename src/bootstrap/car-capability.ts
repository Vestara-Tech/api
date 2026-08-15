import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerCarCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.car',
    namespace: 'car',
    version: config.apiVersion,
    permissions: ['car.read', 'car.runtimes', 'car.sessions', 'car.gateway'],
    operations: ['car.runtimes.list', 'car.select', 'car.session.create', 'car.gateway.execute', 'car.health'],
  });
}
