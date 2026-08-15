import { conflict, notFound } from '../../core/errors.js';
import { randomId } from '../../core/identifiers.js';
import type { DashboardDefinition, DashboardFilter, RefreshPolicy, WidgetInstance } from '../domain/dashboard.js';
import { DashboardWidgetRegistry } from '../registry/widget-registry.js';
import type { DashboardStorePort } from '../store/dashboard-store.js';
import { InMemoryDashboardStore } from '../store/dashboard-store.js';
import type { DashboardValidationResult } from '../domain/dashboard-validation.js';
import { DashboardValidator, bumpDashboardRevision } from '../domain/dashboard-validation.js';

export interface DashboardServiceOptions {
  readonly store?: DashboardStorePort;
  readonly registry?: DashboardWidgetRegistry;
  readonly currentPermissions?: () => readonly string[];
}

/**
 * DASH-010 — DashboardService. Owns presentation/composition/layout; source
 * modules own their state. Widgets resolve through the registry; validation
 * enforces permission filtering (DASH-011); publishing freezes a revision.
 */
export class DashboardService {
  private readonly store: DashboardStorePort;
  private readonly registry: DashboardWidgetRegistry;
  private readonly validator: DashboardValidator;
  private readonly currentPermissions: () => readonly string[];

  constructor(options: DashboardServiceOptions = {}) {
    this.store = options.store ?? new InMemoryDashboardStore();
    this.registry = options.registry ?? new DashboardWidgetRegistry();
    this.validator = new DashboardValidator(this.registry);
    this.currentPermissions = options.currentPermissions ?? (() => []);
  }

  create(input: Omit<DashboardDefinition, 'revision' | 'createdAt' | 'updatedAt'>): DashboardDefinition {
    if (this.store.get(input.id)) throw conflict(`Dashboard "${input.id}" already exists`);
    const dashboard: DashboardDefinition = { ...input, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const validation = this.validate(dashboard);
    if (!validation.ok) throw conflict(`Invalid dashboard: ${validation.issues.map((i) => i.message).join('; ')}`);
    this.store.save(dashboard);
    return dashboard;
  }

  update(id: string, patch: Partial<Omit<DashboardDefinition, 'id' | 'revision' | 'createdAt' | 'updatedAt'>>): DashboardDefinition {
    const current = this.store.get(id);
    if (!current) throw notFound(`Dashboard "${id}" not found`);
    const next = bumpDashboardRevision({ ...current, ...patch, id: current.id });
    const validation = this.validate(next);
    if (!validation.ok) throw conflict(`Invalid dashboard: ${validation.issues.map((i) => i.message).join('; ')}`);
    this.store.save(next);
    return next;
  }

  get(id: string): DashboardDefinition {
    const dashboard = this.store.get(id);
    if (!dashboard) throw notFound(`Dashboard "${id}" not found`);
    return dashboard;
  }

  list(): readonly DashboardDefinition[] {
    return this.store.list();
  }

  remove(id: string): void {
    if (!this.store.get(id)) throw notFound(`Dashboard "${id}" not found`);
    this.store.remove(id);
  }

  /** DASH-020 — clone creates a new id + revision 1. */
  clone(id: string, newId?: string): DashboardDefinition {
    const dashboard = this.get(id);
    const clone: DashboardDefinition = {
      ...dashboard,
      id: newId ?? randomId('dash'),
      name: `${dashboard.name} (copy)`,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    delete (clone as { publishedAt?: string }).publishedAt;
    this.store.save(clone);
    return clone;
  }

  /** DASH-020 — reset to revision 1 of the same definition shape. */
  reset(id: string): DashboardDefinition {
    const dashboard = this.get(id);
    const reset: DashboardDefinition = { ...dashboard, revision: 1, updatedAt: new Date().toISOString() };
    this.store.save(reset);
    return reset;
  }

  addWidget(id: string, widget: Omit<WidgetInstance, 'state'>): DashboardDefinition {
    const dashboard = this.get(id);
    const instance: WidgetInstance = { ...widget, state: 'loading' };
    return this.update(id, { widgets: [...dashboard.widgets, instance] });
  }

  updateWidget(id: string, widgetId: string, patch: Partial<Omit<WidgetInstance, 'id'>>): DashboardDefinition {
    const dashboard = this.get(id);
    const widgets = dashboard.widgets.map((w) => (w.id === widgetId ? { ...w, ...patch, id: w.id } : w));
    return this.update(id, { widgets });
  }

  removeWidget(id: string, widgetId: string): DashboardDefinition {
    const dashboard = this.get(id);
    return this.update(id, { widgets: dashboard.widgets.filter((w) => w.id !== widgetId) });
  }

  updateFilters(id: string, filters: readonly DashboardFilter[]): DashboardDefinition {
    return this.update(id, { filters });
  }

  updateRefreshPolicy(id: string, refreshPolicy: RefreshPolicy): DashboardDefinition {
    return this.update(id, { refreshPolicy });
  }

  /** DASH-011 — permission filtering. Filters widgets whose required permissions the user lacks. */
  visibleWidgets(id: string): DashboardDefinition {
    const dashboard = this.get(id);
    const permissions = this.currentPermissions();
    const visible = dashboard.widgets.filter((w) => {
      let definition;
      try {
        definition = this.registry.getWidget(w.type);
      } catch {
        return false;
      }
      return definition.permissions.length === 0 || definition.permissions.some((p) => permissions.includes(p));
    });
    return { ...dashboard, widgets: visible };
  }

  validate(dashboard: DashboardDefinition): DashboardValidationResult {
    return this.validator.validate(dashboard, this.currentPermissions());
  }

  /** DASH-020 — publish freezes a revision. */
  publish(id: string): DashboardDefinition {
    const dashboard = this.get(id);
    const validation = this.validate(dashboard);
    if (!validation.ok) throw conflict(`Cannot publish invalid dashboard: ${validation.issues.map((i) => i.message).join('; ')}`);
    const published = { ...dashboard, publishedAt: new Date().toISOString() };
    this.store.save(published);
    return published;
  }

  nextId(prefix = 'dash'): string {
    return randomId(prefix);
  }
}
