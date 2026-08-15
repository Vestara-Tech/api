import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerTemplateCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.templates',
    namespace: 'templates',
    version: config.apiVersion,
    permissions: ['template.read', 'template.write', 'template.instantiate'],
    operations: ['templates.list', 'template.get', 'template.register', 'template.instantiate', 'template.listKinds', 'template.remove'],
  });
}
