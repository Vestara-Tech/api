import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerFileCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.files',
    namespace: 'files',
    version: config.apiVersion,
    permissions: ['file.read', 'file.list', 'file.stat', 'file.search', 'file.write', 'file.transaction'],
    operations: ['file.workspaces.list', 'file.workspace.read', 'file.workspace.list', 'file.workspace.search', 'file.transaction.create', 'file.transaction.preview', 'file.transaction.apply'],
  });
}
