import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerAuthCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.auth',
    namespace: 'auth',
    version: config.apiVersion,
    permissions: ['auth.identity.manage', 'auth.session.manage', 'auth.credential.manage'],
    operations: [
      'auth.login',
      'auth.logout',
      'auth.identity.read',
      'auth.session.list',
      'auth.session.revoke',
      'auth.permission.check',
    ],
  });
}
