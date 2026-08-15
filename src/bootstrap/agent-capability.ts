import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerAgentCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.agents',
    namespace: 'agents',
    version: config.apiVersion,
    permissions: ['agent.read', 'agent.run', 'agent.tools', 'agent.skills'],
    operations: ['agent.list', 'agent.run.start', 'agent.run.list', 'agent.run.cancel', 'agent.tools.list', 'agent.skills.list'],
  });
}
