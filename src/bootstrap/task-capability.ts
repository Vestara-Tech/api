import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerTaskCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.tasks',
    namespace: 'tasks',
    version: config.apiVersion,
    permissions: ['task.read', 'task.manage', 'task.transition', 'task.assign'],
    operations: ['tasks.list', 'task.create', 'task.get', 'task.assign', 'task.transition', 'task.dependencies', 'task.result', 'task.events'],
  });
}
