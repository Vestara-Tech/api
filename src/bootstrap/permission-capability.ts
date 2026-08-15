import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerPermissionCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.permissions',
    namespace: 'permissions',
    version: config.apiVersion,
    permissions: ['permission.read', 'permission.manage', 'permission.delegate', 'permission.grant'],
    operations: ['permission.list', 'permission.evaluate', 'permission.effective', 'permission.roles.list', 'permission.grant', 'permission.delegate', 'permission.temp.issue'],
  });
}
