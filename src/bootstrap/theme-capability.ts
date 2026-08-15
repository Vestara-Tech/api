import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerThemeCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.themes',
    namespace: 'themes',
    version: config.apiVersion,
    permissions: ['theme.read', 'theme.write', 'theme.publish'],
    operations: ['themes.list', 'theme.get', 'theme.register', 'theme.css', 'theme.mui', 'theme.os', 'theme.resolve'],
  });
}
