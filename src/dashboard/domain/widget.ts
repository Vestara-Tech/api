/** DASH-001/002/003/004/005 — Dashboard, layout, widget and data-source contracts. */

export type DashboardScope = 'system' | 'organization' | 'workspace' | 'project' | 'user';

export type WidgetLoadState = 'loading' | 'ready' | 'empty' | 'stale' | 'degraded' | 'offline' | 'unauthorized' | 'module-disabled' | 'error';

export interface WidgetSize {
  readonly minWidth: number;
  readonly minHeight: number;
}

/** DASH-002 — grid layout model. */
export interface WidgetPlacement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly breakpoint: 'desktop' | 'tablet' | 'mobile';
}

export interface DashboardLayout {
  readonly columns: number;
  readonly rowHeight: number;
  readonly gap: number;
  readonly placements: readonly WidgetPlacement[];
}

/** DASH-005 — data-source contract. */
export interface DashboardDataSource {
  readonly type: 'module' | 'api' | 'projection' | 'static' | 'context';
  readonly moduleId?: string;
  readonly capability?: string;
  readonly operation?: string;
  readonly projection?: string;
  readonly url?: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
}

/** DASH-003 — widget definition contributed by modules. */
export interface DashboardWidgetDefinition {
  readonly type: string;
  readonly moduleId: string;
  readonly title: string;
  readonly description?: string;
  readonly sizes: readonly WidgetSize[];
  readonly defaultSize: WidgetSize;
  readonly dataSource: DashboardDataSource;
  readonly permissions: readonly string[];
  readonly configurable: boolean;
  readonly refreshIntervalSeconds?: number;
}

/** DASH-004 — widget instance placed on a dashboard. */
export interface WidgetInstance {
  readonly id: string;
  readonly type: string;
  readonly title?: string;
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly dataSource?: DashboardDataSource;
  readonly placement: WidgetPlacement;
  readonly refreshIntervalSeconds?: number;
  readonly state: WidgetLoadState;
  readonly lastUpdatedAt?: string;
  readonly error?: string;
}
