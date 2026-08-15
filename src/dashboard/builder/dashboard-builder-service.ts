import { conflict, notFound } from '../../core/errors.js';
import { randomId } from '../../core/identifiers.js';
import type { DashboardDefinition } from '../domain/dashboard.js';
import type { DashboardService } from '../service/dashboard-service.js';
import type { DashboardWidgetRegistry } from '../registry/widget-registry.js';
import { DashboardBuilderSession, type DashboardDraft } from './dashboard-builder-session.js';

export interface DashboardBuilderOptions {
  readonly dashboards: DashboardService;
  readonly registry: DashboardWidgetRegistry;
}

/**
 * DASH-BLD — Dashboard Builder service. Builder edits definitions; Generator
 * produces artifacts from definitions; Runtime renders published definitions.
 * The canonical artifact stays DashboardDefinition.
 */
export class DashboardBuilderService {
  private readonly dashboards: DashboardService;
  private readonly registry: DashboardWidgetRegistry;

  constructor(options: DashboardBuilderOptions) {
    this.dashboards = options.dashboards;
    this.registry = options.registry;
  }

  /** DASH-BLD-002 — open a session from an existing dashboard or blank. */
  open(baseDashboardId?: string): DashboardBuilderSession {
    if (!baseDashboardId) return new DashboardBuilderSession();
    const base = this.dashboards.get(baseDashboardId);
    return new DashboardBuilderSession(base);
  }

  /** DASH-BLD-012 — validate + publish a draft into the DashboardService. */
  publish(session: DashboardBuilderSession, id?: string): DashboardDefinition {
    const draft = session.getDraft().definition;
    const validation = this.dashboards.validate(draft);
    if (!validation.ok) throw conflict(`Cannot publish invalid dashboard: ${validation.issues.map((i) => i.message).join('; ')}`);
    session.markValidated();
    session.markPreviewing();

    const targetId = id ?? draft.id ?? randomId('dash');
    if (this.dashboards.list().some((d) => d.id === targetId)) {
      return this.dashboards.update(targetId, draft);
    }
    return this.dashboards.create({ ...draft, id: targetId });
  }

  /** DASH-BLD-013 — save a published dashboard as a template source (definition snapshot). */
  saveAsTemplate(id: string): { templateId: string; definition: DashboardDefinition } {
    const definition = this.dashboards.get(id);
    return { templateId: randomId('tpl'), definition };
  }

  validateDraft(draft: DashboardDraft) {
    return this.dashboards.validate(draft.definition);
  }

  availableWidgets() {
    return this.registry.listWidgets();
  }
}

export { notFound };
