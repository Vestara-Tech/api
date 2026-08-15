import type { EventBus } from '../core/events.js';
import { StartupCoordinator } from '../startup/service/startup-coordinator.js';
import type { StartupServiceDefinition } from '../startup/domain/readiness.js';

const STARTUP_SERVICES: readonly StartupServiceDefinition[] = [
  { id: 'system', name: 'System', category: 'system', weight: 10, required: true },
  { id: 'storage', name: 'Storage', category: 'storage', weight: 10, required: true, dependsOn: ['system'] },
  { id: 'configuration', name: 'Configuration', category: 'configuration', weight: 15, required: true, dependsOn: ['system'] },
  { id: 'api', name: 'Vestara API', category: 'api', weight: 20, required: true, dependsOn: ['system', 'configuration'] },
  { id: 'authentication', name: 'Authentication', category: 'authentication', weight: 15, required: true, dependsOn: ['api', 'configuration'] },
  { id: 'integrations', name: 'Integrations', category: 'integrations', weight: 10, required: false, dependsOn: ['api'] },
  { id: 'agents', name: 'Agents', category: 'agents', weight: 10, required: false, dependsOn: ['api', 'authentication'] },
  { id: 'workspace', name: 'Workspace', category: 'workspace', weight: 10, required: true, dependsOn: ['api', 'authentication', 'storage'] },
];

export function buildStartupCoordinator(events: EventBus): StartupCoordinator {
  return new StartupCoordinator({ events, services: STARTUP_SERVICES });
}
