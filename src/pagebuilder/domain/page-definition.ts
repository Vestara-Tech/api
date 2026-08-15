/** PAGE-001..013 — Page Builder domain contracts. */

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export type BindingSource = 'api' | 'database' | 'context' | 'configuration' | 'state' | 'currentUser';

export interface ComponentReference {
  readonly definitionId: string;
  readonly definitionVersion?: string;
}

export type PropertyValue = unknown;

/** PAGE-008 — state binding. */
export interface StateBinding {
  readonly id: string;
  readonly key: string;
  readonly initialValue?: unknown;
  readonly scope: 'page' | 'application' | 'session';
}

/** PAGE-006 — data binding. */
export interface DataBinding {
  readonly id: string;
  readonly source: BindingSource;
  readonly operation: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly target?: string;
  readonly refreshOn?: readonly string[];
}

/** PAGE-007 — event/action binding. */
export type ActionKind =
  | 'navigate'
  | 'api.call'
  | 'workflow.start'
  | 'dialog.open'
  | 'notification.send'
  | 'state.set'
  | 'form.submit'
  | 'agent.invoke';

export interface ActionBinding {
  readonly id: string;
  readonly kind: ActionKind;
  readonly target?: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
}

export interface EventBinding {
  readonly event: string;
  readonly actionId: string;
}

/** PAGE-009 — permission binding. */
export interface PermissionBinding {
  readonly id: string;
  readonly permission: string;
  readonly mode: 'show' | 'hide' | 'disable';
}

export interface ResponsiveProps {
  readonly breakpoint: Breakpoint;
  readonly properties: Readonly<Record<string, PropertyValue>>;
}

export interface PageNode {
  readonly id: string;
  readonly component: ComponentReference;
  readonly props: Readonly<Record<string, PropertyValue>>;
  readonly bindings: readonly DataBinding[];
  readonly events: readonly EventBinding[];
  readonly actions: readonly ActionBinding[];
  readonly state: readonly StateBinding[];
  readonly permissions: readonly PermissionBinding[];
  readonly children: readonly PageNode[];
  readonly visibleWhen?: string;
}

export interface LayoutDefinition {
  readonly type: 'default' | 'header-sidebar-content' | 'sidebar-content' | 'single';
  readonly header?: PageNode;
  readonly sidebar?: PageNode;
  readonly content: PageNode;
  readonly footer?: PageNode;
}

export interface PageMetadata {
  readonly title: string;
  readonly icon?: string;
  readonly description?: string;
  readonly authRequired: boolean;
}

export interface PageResponsiveRule {
  readonly breakpoint: Breakpoint;
  readonly layout: 'stack' | 'grid';
  readonly columns?: number;
}

export interface PageDefinition {
  readonly id: string;
  readonly name: string;
  readonly route: string;
  readonly layout: LayoutDefinition;
  readonly nodes: readonly PageNode[];
  readonly dataSources: readonly DataBinding[];
  readonly actions: readonly ActionBinding[];
  readonly permissions: readonly PermissionBinding[];
  readonly responsive: readonly PageResponsiveRule[];
  readonly metadata: PageMetadata;
  readonly revision: number;
  readonly updatedAt: string;
}
