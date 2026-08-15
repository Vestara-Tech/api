import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerWorkflowCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.workflows',
    namespace: 'workflows',
    version: config.apiVersion,
    permissions: ['workflow.read', 'workflow.define', 'workflow.publish', 'workflow.run', 'workflow.observe'],
    operations: ['workflow.list', 'workflow.create', 'workflow.validate', 'workflow.publish', 'workflow.run.start', 'workflow.run.list', 'workflow.run.cancel', 'workflow.run.resume', 'workflow.run.retry'],
  });
}
