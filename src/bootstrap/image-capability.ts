import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerImageCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.image',
    namespace: 'image',
    version: config.apiVersion,
    permissions: ['image.read', 'image.plan', 'image.build'],
    operations: ['image.profiles.list', 'image.plan', 'image.build', 'image.build.state'],
  });
}
