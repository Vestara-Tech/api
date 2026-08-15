import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerComponentCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.components',
    namespace: 'components',
    version: config.apiVersion,
    permissions: ['component.read', 'component.manage', 'component.compose'],
    operations: ['components.list', 'component.get', 'component.categories', 'component.search', 'component.register', 'component.trees', 'component.tree.validate'],
  });
}
