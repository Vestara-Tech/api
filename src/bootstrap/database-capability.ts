import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerDatabaseCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.database',
    namespace: 'database',
    version: config.apiVersion,
    permissions: ['database.read', 'database.define', 'database.migrate', 'database.query'],
    operations: ['database.definitions.list', 'database.definition.create', 'database.migration.plan', 'database.connections.list', 'database.connection.test', 'database.query'],
  });
}
