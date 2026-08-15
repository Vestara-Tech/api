/** DASH-006/007/008 — Projection, filter, refresh-policy and dashboard definition. */

import type { DashboardLayout, DashboardScope } from './widget.js';
import type { WidgetInstance } from './widget.js';

export type { DashboardLayout, DashboardScope, WidgetInstance } from './widget.js';

/** DASH-006 — projection contract. A module exposes read-model projections for aggregation. */
export interface DashboardProjectionDefinition {
  readonly id: string;
  readonly moduleId: string;
  readonly title: string;
  readonly description?: string;
  readonly permissions: readonly string[];
}

export interface ProjectionResult {
  readonly projectionId: string;
  readonly moduleId: string;
  readonly state: 'ready' | 'empty' | 'degraded' | 'offline' | 'module-disabled' | 'error' | 'unauthorized';
  readonly data?: unknown;
  readonly error?: string;
  readonly durationMs?: number;
  readonly cachedAt?: string;
  readonly stale?: boolean;
}

/** DASH-007 — dashboard filter. */
export type DashboardFilterOperator = 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than' | 'in' | 'between';

export interface DashboardFilter {
  readonly id: string;
  readonly field: string;
  readonly operator: DashboardFilterOperator;
  readonly value: unknown;
  readonly label?: string;
  readonly appliesTo?: readonly string[]; // widget ids; undefined = all
}

/** DASH-008 — refresh policy. */
export interface RefreshPolicy {
  readonly mode: 'off' | 'interval' | 'on-event';
  readonly intervalSeconds?: number;
  readonly maxStalenessSeconds?: number;
  readonly onEvents?: readonly string[];
}

export interface DashboardDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly scope: DashboardScope;
  readonly layout: DashboardLayout;
  readonly widgets: readonly WidgetInstance[];
  readonly filters: readonly DashboardFilter[];
  readonly refreshPolicy: RefreshPolicy;
  readonly ownerUserId?: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt?: string;
}
