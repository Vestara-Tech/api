import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerAiCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.ai',
    namespace: 'ai',
    version: config.apiVersion,
    permissions: ['ai.generate', 'ai.stream', 'ai.embed', 'ai.models.read', 'ai.providers.read', 'ai.routing.read', 'ai.usage.read'],
    operations: ['ai.models.list', 'ai.providers.list', 'ai.routing.resolve', 'ai.generate', 'ai.stream', 'ai.usage.list'],
  });
}
