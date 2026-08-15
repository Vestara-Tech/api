import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerMarketplaceV2Capability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.marketplace-v2',
    namespace: 'marketplace-v2',
    version: config.apiVersion,
    permissions: ['marketplace.read', 'marketplace.install', 'marketplace.publish', 'marketplace.manage'],
    operations: ['marketplace.contributions', 'marketplace.resolve', 'marketplace.bundles', 'marketplace.distributions', 'marketplace.publish', 'marketplace.publishers', 'marketplace.published'],
  });
}
