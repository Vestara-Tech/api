import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerLoginCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.login',
    namespace: 'login',
    version: config.apiVersion,
    permissions: ['login.read', 'login.authenticate', 'login.session'],
    operations: ['login.capabilities.read', 'login.users.list', 'login.authenticate', 'login.session.start', 'login.preAuth.check'],
  });
}
