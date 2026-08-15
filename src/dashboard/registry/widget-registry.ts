import { notFound } from '../../core/errors.js';
import type { DashboardWidgetDefinition } from '../domain/widget.js';
import type { DashboardProjectionDefinition } from '../domain/dashboard.js';
import type { DashboardContribution, ModuleLifecyclePort } from '../domain/contribution.js';

export interface WidgetRegistryOptions {
  readonly lifecycle?: ModuleLifecyclePort;
}

/**
 * DASH-007 — Widget registry. Installed modules contribute widgets via
 * DashboardContribution; disabling a module automatically makes its widgets
 * unavailable. Dashboard never hard-codes module knowledge.
 */
export class DashboardWidgetRegistry {
  private readonly contributions = new Map<string, DashboardContribution>();
  private readonly widgets = new Map<string, DashboardWidgetDefinition>();
  private readonly projections = new Map<string, DashboardProjectionDefinition>();
  private readonly lifecycle: ModuleLifecyclePort;

  constructor(options: WidgetRegistryOptions = {}) {
    this.lifecycle = options.lifecycle ?? { isEnabled: () => true };
  }

  register(contribution: DashboardContribution): void {
    this.contributions.set(contribution.moduleId, contribution);
    for (const widget of contribution.widgets) {
      this.widgets.set(widget.type, widget);
    }
    for (const projection of contribution.projections ?? []) {
      this.projections.set(projection.id, projection);
    }
  }

  unregister(moduleId: string): void {
    const contribution = this.contributions.get(moduleId);
    if (!contribution) return;
    for (const widget of contribution.widgets) this.widgets.delete(widget.type);
    for (const projection of contribution.projections ?? []) this.projections.delete(projection.id);
    this.contributions.delete(moduleId);
  }

  getWidget(type: string): DashboardWidgetDefinition {
    const widget = this.widgets.get(type);
    if (!widget) throw notFound(`Dashboard widget "${type}" not found`);
    return widget;
  }

  hasWidget(type: string): boolean {
    return this.widgets.has(type);
  }

  getWidgetSafe(type: string): DashboardWidgetDefinition | undefined {
    return this.widgets.get(type);
  }

  listWidgets(): readonly DashboardWidgetDefinition[] {
    return [...this.widgets.values()].filter((w) => this.lifecycle.isEnabled(w.moduleId));
  }

  listByModule(moduleId: string): readonly DashboardWidgetDefinition[] {
    return this.listWidgets().filter((w) => w.moduleId === moduleId);
  }

  getProjection(id: string): DashboardProjectionDefinition | undefined {
    return this.projections.get(id);
  }

  listProjections(): readonly DashboardProjectionDefinition[] {
    return [...this.projections.values()].filter((p) => this.lifecycle.isEnabled(p.moduleId));
  }

  listModules(): readonly string[] {
    return [...this.contributions.keys()].filter((m) => this.lifecycle.isEnabled(m));
  }
}
