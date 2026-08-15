import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';
import { SYSTEM_CAPABILITIES } from '../system/domain/capabilities.js';

export function registerSystemModuleCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.system',
    namespace: 'system-module',
    version: config.apiVersion,
    permissions: SYSTEM_CAPABILITIES.map((c) => c.id),
    operations: SYSTEM_CAPABILITIES.map((c) => c.id),
  });
}
