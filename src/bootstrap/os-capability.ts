import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';
import { OS_CAPABILITIES } from '../os/domain/os-capability.js';

export function registerOsCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.os',
    namespace: 'os',
    version: config.apiVersion,
    permissions: OS_CAPABILITIES.map((c) => c.id),
    operations: OS_CAPABILITIES.map((c) => c.id),
  });
}
