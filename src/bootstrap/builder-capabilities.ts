import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerPageBuilderCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.page-builder',
    namespace: 'page-builder',
    version: config.apiVersion,
    permissions: ['page.read', 'page.write', 'page.publish'],
    operations: ['pages.list', 'page.create', 'page.get', 'page.update', 'page.remove', 'page.validate', 'page.diff'],
  });
}

export function registerApplicationBuilderCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.application-builder',
    namespace: 'application-builder',
    version: config.apiVersion,
    permissions: ['application.read', 'application.write', 'application.publish'],
    operations: ['applications.list', 'application.create', 'application.get', 'application.update', 'application.remove', 'application.transition', 'application.model'],
  });
}
