import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerDiagnosticsCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.diagnostics',
    namespace: 'diagnostics',
    version: config.apiVersion,
    permissions: ['diagnostics.read', 'diagnostics.run'],
    operations: ['diagnostics.checks.list', 'diagnostics.run', 'diagnostics.runs.list', 'diagnostics.finding'],
  });
}
