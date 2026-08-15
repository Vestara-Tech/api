import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerMilestoneCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.milestones',
    namespace: 'milestones',
    version: config.apiVersion,
    permissions: ['milestone.read', 'milestone.manage', 'milestone.verify'],
    operations: ['milestones.list', 'milestone.create', 'milestone.get', 'milestone.tasks', 'milestone.progress', 'milestone.health', 'milestone.verify', 'milestone.complete'],
  });
}
