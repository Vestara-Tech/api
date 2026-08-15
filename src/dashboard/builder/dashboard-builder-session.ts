/** DASH-BLD-001/002/003 — Dashboard draft, builder session, canvas state. */

import { randomId } from '../../core/identifiers.js';
import type { DashboardDefinition, WidgetInstance } from '../domain/dashboard.js';

export interface BuilderSessionState {
  readonly sessionId: string;
  readonly draftId: string;
  readonly status: 'editing' | 'validated' | 'previewing' | 'published' | 'discarded';
  readonly startedAt: string;
  readonly lastEditedAt: string;
}

/** DASH-BLD-001 — A working draft of a DashboardDefinition. */
export interface DashboardDraft {
  readonly draftId: string;
  readonly baseDashboardId?: string;
  readonly definition: DashboardDefinition;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WidgetPlacementChange {
  readonly widgetId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BuilderOperation {
  readonly id: string;
  readonly kind: 'add-widget' | 'remove-widget' | 'move-widget' | 'configure-widget' | 'update-filters' | 'update-refresh' | 'update-layout';
  readonly at: string;
  readonly undo?: unknown;
}

/** DASH-BLD-002 — Builder session. Owns the draft lifecycle. */
export class DashboardBuilderSession {
  private session: BuilderSessionState;
  private draft: DashboardDraft;
  private readonly operations: readonly BuilderOperation[] = [];

  constructor(base?: DashboardDefinition) {
    const now = new Date().toISOString();
    this.session = {
      sessionId: randomId('session'),
      draftId: randomId('draft'),
      status: 'editing',
      startedAt: now,
      lastEditedAt: now,
    };
    this.draft = base
      ? { draftId: this.session.draftId, baseDashboardId: base.id, definition: base, createdAt: now, updatedAt: now }
      : { draftId: this.session.draftId, definition: emptyDefinition(), createdAt: now, updatedAt: now };
  }

  getSession(): BuilderSessionState {
    return this.session;
  }

  getDraft(): DashboardDraft {
    return this.draft;
  }

  patch(patch: Partial<DashboardDefinition>): DashboardDraft {
    this.draft = { ...this.draft, definition: { ...this.draft.definition, ...patch }, updatedAt: new Date().toISOString() };
    this.session = { ...this.session, lastEditedAt: new Date().toISOString() };
    return this.draft;
  }

  addWidget(widget: WidgetInstance): DashboardDraft {
    return this.patch({ widgets: [...this.draft.definition.widgets, widget] });
  }

  removeWidget(widgetId: string): DashboardDraft {
    return this.patch({ widgets: this.draft.definition.widgets.filter((w) => w.id !== widgetId) });
  }

  /** DASH-BLD-003 — move/resize a widget on the canvas grid. */
  placeWidget(change: WidgetPlacementChange): DashboardDraft {
    return this.patch({
      widgets: this.draft.definition.widgets.map((w) => (w.id === change.widgetId ? { ...w, placement: { x: change.x, y: change.y, width: change.width, height: change.height, breakpoint: w.placement.breakpoint } } : w)),
    });
  }

  markValidated(): void {
    this.session = { ...this.session, status: 'validated' };
  }

  markPreviewing(): void {
    this.session = { ...this.session, status: 'previewing' };
  }

  /** DASH-BLD-012 — publish returns the frozen definition. */
  publish(): DashboardDefinition {
    this.session = { ...this.session, status: 'published' };
    return { ...this.draft.definition, revision: this.draft.definition.revision + 1, publishedAt: new Date().toISOString() };
  }

  operationCount(): number {
    return this.operations.length;
  }
}

export function emptyDefinition(): DashboardDefinition {
  const now = new Date().toISOString();
  return {
    id: '',
    name: '',
    scope: 'user',
    layout: { columns: 12, rowHeight: 30, gap: 8, placements: [] },
    widgets: [],
    filters: [],
    refreshPolicy: { mode: 'interval', intervalSeconds: 30 },
    revision: 0,
    createdAt: now,
    updatedAt: now,
  };
}
