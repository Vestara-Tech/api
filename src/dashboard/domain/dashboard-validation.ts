import type { DashboardDefinition } from './dashboard.js';
import type { DashboardWidgetRegistry } from '../registry/widget-registry.js';

export interface DashboardValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface DashboardValidationResult {
  readonly ok: boolean;
  readonly issues: readonly DashboardValidationIssue[];
}

/**
 * DASH-019 — Dashboard validation. Widget types must resolve in the registry
 * (module lifecycle honored), grid placements must be in-bounds, and widget
 * instances must carry the permissions required by their definitions.
 */
export class DashboardValidator {
  private readonly registry: DashboardWidgetRegistry;

  constructor(registry: DashboardWidgetRegistry) {
    this.registry = registry;
  }

  validate(dashboard: DashboardDefinition, allowedPermissions?: readonly string[]): DashboardValidationResult {
    const issues: DashboardValidationIssue[] = [];

    if (!dashboard.id) issues.push({ path: 'id', message: 'Dashboard id is required', severity: 'error' });
    if (!dashboard.name) issues.push({ path: 'name', message: 'Dashboard name is required', severity: 'error' });
    if (dashboard.layout.columns < 1) issues.push({ path: 'layout.columns', message: 'Layout columns must be positive', severity: 'error' });

    for (const widget of dashboard.widgets) {
      let definition;
      try {
        definition = this.registry.getWidget(widget.type);
      } catch {
        issues.push({ path: `widgets.${widget.id}`, message: `Unknown widget type "${widget.type}"`, severity: 'error' });
        continue;
      }
      if (widget.placement.x + widget.placement.width > dashboard.layout.columns) {
        issues.push({ path: `widgets.${widget.id}.placement`, message: 'Widget placement exceeds layout columns', severity: 'error' });
      }
      if (allowedPermissions && definition.permissions.length > 0) {
        const missing = definition.permissions.filter((p) => !allowedPermissions.includes(p));
        if (missing.length > 0) {
          issues.push({ path: `widgets.${widget.id}`, message: `Missing permissions: ${missing.join(', ')}`, severity: 'warning' });
        }
      }
    }

    return { ok: issues.every((i) => i.severity !== 'error'), issues };
  }
}

/** DASH-020 — revision bumping. */
export function bumpDashboardRevision(dashboard: DashboardDefinition): DashboardDefinition {
  return { ...dashboard, revision: dashboard.revision + 1, updatedAt: new Date().toISOString() };
}
