import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';
import { USER_CAPABILITIES } from '../user/domain/user-capability.js';

export function registerUserCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.users',
    namespace: 'users',
    version: config.apiVersion,
    permissions: USER_CAPABILITIES.map((c) => c.id),
    operations: USER_CAPABILITIES.map((c) => c.id),
  });
}
