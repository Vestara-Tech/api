import { DashboardWidgetRegistry } from '../dashboard/registry/widget-registry.js';
import { DashboardService } from '../dashboard/service/dashboard-service.js';
import { ProjectionService } from '../dashboard/service/projection-service.js';
import { allDashboardContributions } from '../dashboard/contributions/builtin.js';
import { DashboardBuilderService } from '../dashboard/builder/dashboard-builder-service.js';
import { DashboardGenerator } from '../dashboard/builder/dashboard-generator.js';

export interface DashboardPlatform {
  readonly registry: DashboardWidgetRegistry;
  readonly service: DashboardService;
  readonly projections: ProjectionService;
  readonly builder: DashboardBuilderService;
  readonly generator: DashboardGenerator;
}

/**
 * DASH — Composition root. Registers first-party dashboard contributions
 * (system/task/agent/workflow/diagnostics/database/notification). Modules
 * contribute widgets + projections; Dashboard core never hard-codes them.
 */
export function buildDashboardPlatform(options: { currentPermissions?: () => readonly string[] } = {}): DashboardPlatform {
  const registry = new DashboardWidgetRegistry();
  for (const contribution of allDashboardContributions()) registry.register(contribution);
  const projections = new ProjectionService();
  const service = new DashboardService({ registry, ...(options.currentPermissions ? { currentPermissions: options.currentPermissions } : {}) });
  const builder = new DashboardBuilderService({ dashboards: service, registry });
  const generator = new DashboardGenerator(registry);
  return { registry, service, projections, builder, generator };
}
