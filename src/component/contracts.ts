/** COMP-001..008 — Component Module contracts. */

export type ComponentCategory =
  | 'primitive' | 'layout' | 'navigation' | 'input' | 'form' | 'data-display' | 'data-grid'
  | 'feedback' | 'overlay' | 'media' | 'chart' | 'editor' | 'terminal' | 'activity'
  | 'workflow' | 'agent' | 'builder' | 'system' | 'dashboard' | 'page' | 'template'
  | 'composite' | 'custom';

export type ComponentRendererReference =
  | { readonly kind: 'react'; readonly import: string; readonly path: string }
  | { readonly kind: 'web-component'; readonly tag: string }
  | { readonly kind: 'custom'; readonly id: string };

export type ComponentPropertyType =
  | 'string' | 'number' | 'boolean' | 'enum' | 'color' | 'icon' | 'asset'
  | 'expression' | 'binding' | 'object' | 'array';

export interface ComponentPropertyDefinition {
  readonly name: string;
  readonly type: ComponentPropertyType;
  readonly required?: boolean;
  readonly defaultValue?: unknown;
  readonly editor?: string;
  readonly enumValues?: readonly string[];
  readonly validation?: Readonly<Record<string, unknown>>;
}

export interface ComponentSlotDefinition {
  readonly name: string;
  readonly accepts?: readonly string[];
  readonly required?: boolean;
  readonly maxChildren?: number;
}

export interface ComponentEventDefinition {
  readonly name: string;
  readonly kind: 'click' | 'change' | 'submit' | 'select' | 'open' | 'close' | 'focus' | 'drop' | 'execute' | 'custom';
  readonly payload?: unknown;
}

export type ComponentActionKind =
  | 'api' | 'workflow' | 'agent' | 'task' | 'navigation' | 'dialog' | 'state' | 'custom';

export interface ComponentActionDefinition {
  readonly id: string;
  readonly name: string;
  readonly kind: ComponentActionKind;
  readonly target?: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
}

export interface ComponentPreviewDefinition {
  readonly story?: string;
  readonly props?: Readonly<Record<string, unknown>>;
}

export interface ComponentDefinition {
  readonly id: string;
  readonly packageId: string;
  readonly name: string;
  readonly displayName: string;
  readonly version: string;
  readonly category: ComponentCategory;
  readonly renderer: ComponentRendererReference;
  readonly properties: readonly ComponentPropertyDefinition[];
  readonly slots: readonly ComponentSlotDefinition[];
  readonly events: readonly ComponentEventDefinition[];
  readonly actions: readonly ComponentActionDefinition[];
  readonly capabilities: readonly string[];
  readonly permissions: readonly string[];
  readonly designTokens: readonly string[];
  readonly preview?: ComponentPreviewDefinition;
  readonly status: 'draft' | 'validating' | 'ready' | 'publishing' | 'published' | 'deprecated' | 'retired';
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** COMP-002 — component instance (definition + configuration). */
export interface ComponentBinding {
  readonly source: 'api' | 'database' | 'context' | 'configuration' | 'workflow' | 'agent' | 'task' | 'system' | 'state';
  readonly operation?: string;
  readonly property?: string;
  readonly target?: string;
}

export interface ComponentEventBinding {
  readonly event: string;
  readonly actionId: string;
}

export interface VisibilityExpression {
  readonly expression: string;
}

export interface ComponentInstance {
  readonly id: string;
  readonly definitionId: string;
  readonly definitionVersion: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly bindings: readonly ComponentBinding[];
  readonly eventBindings: readonly ComponentEventBinding[];
  readonly slots: Readonly<Record<string, readonly ComponentInstance[]>>;
  readonly visibility?: VisibilityExpression;
}

/** COMP-009 — component tree. */
export interface ComponentTree {
  readonly id: string;
  readonly name: string;
  readonly root: ComponentInstance;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ComponentTreeValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface ComponentTreeValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ComponentTreeValidationIssue[];
}
