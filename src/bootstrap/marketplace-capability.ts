import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerMarketplaceCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.marketplace',
    namespace: 'marketplace',
    version: config.apiVersion,
    permissions: ['marketplace.read', 'marketplace.install', 'marketplace.manage'],
    operations: ['marketplace.packages.list', 'marketplace.search', 'marketplace.categories', 'marketplace.install', 'marketplace.enable', 'marketplace.disable', 'marketplace.uninstall', 'marketplace.update', 'marketplace.rollback', 'marketplace.installed'],
  });
}
