/** DASH-008 — module contribution contract. */

import type { DashboardProjectionDefinition } from './dashboard.js';
import type { DashboardWidgetDefinition } from './widget.js';

export interface DashboardContribution {
  readonly moduleId: string;
  readonly widgets: readonly DashboardWidgetDefinition[];
  readonly projections?: readonly DashboardProjectionDefinition[];
}

export interface DashboardContributionSource {
  readonly contribute: () => readonly DashboardContribution[];
}

export interface ModuleLifecyclePort {
  isEnabled(moduleId: string): boolean;
}
