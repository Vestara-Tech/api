import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerVerificationCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.verification',
    namespace: 'verification',
    version: config.apiVersion,
    permissions: ['verification.read', 'verification.run'],
    operations: ['verification.latest', 'verification.run'],
  });
}
