import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerDashboardCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.dashboard',
    namespace: 'dashboard',
    version: config.apiVersion,
    permissions: ['dashboard.read', 'dashboard.write', 'dashboard.publish'],
    operations: ['dashboards.list', 'dashboard.create', 'dashboard.get', 'dashboard.update', 'dashboard.remove', 'dashboard.clone', 'dashboard.reset', 'dashboard.publish', 'dashboard.validate', 'dashboard.projection', 'widgets.list'],
  });
}
