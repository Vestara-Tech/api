/** TPL-001..004 — Template domain contracts. */

export type TemplateKind =
  | 'application'
  | 'page'
  | 'dashboard'
  | 'component'
  | 'api'
  | 'database'
  | 'workflow'
  | 'agent'
  | 'task'
  | 'project'
  | 'os-image'
  | 'configuration';

export type TemplateParameterType = 'string' | 'number' | 'boolean' | 'enum' | 'theme-reference' | 'workspace-reference';

export interface TemplateParameter {
  readonly name: string;
  readonly type: TemplateParameterType;
  readonly required?: boolean;
  readonly defaultValue?: unknown;
  readonly enumValues?: readonly string[];
  readonly description?: string;
}

export interface TemplateMetadata {
  readonly author?: string;
  readonly version: string;
  readonly license?: string;
  readonly tags: readonly string[];
}

export interface TemplateDefinition<TDefinition = unknown> {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly kind: TemplateKind;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly parameters: readonly TemplateParameter[];
  readonly definition: TDefinition;
  readonly recommendedThemeId?: string;
  readonly requiredCapabilities: readonly string[];
  readonly metadata: TemplateMetadata;
}

export interface TemplateParameterValues {
  [name: string]: unknown;
}

/** TPL-004 — constrained variable resolution. Only template parameters + safe context refs. */
export interface TemplateContext {
  readonly parameters: TemplateParameterValues;
  readonly projectName?: string;
  readonly workspaceId?: string;
  readonly userId?: string;
  readonly userName?: string;
}

const CONTEXT_KEYS: readonly string[] = ['projectName', 'workspaceId', 'userId', 'userName'];

export function contextValue(context: TemplateContext, key: string): unknown {
  if (key.startsWith('parameters.')) return context.parameters[key.slice('parameters.'.length)];
  if (key.startsWith('context.')) {
    const name = key.slice('context.'.length);
    if (CONTEXT_KEYS.includes(name)) return context[name as keyof TemplateContext];
  }
  return undefined;
}

/**
 * TPL-004 — Constrained variable resolution: `{{parameters.x}}` and
 * `{{context.projectName}}`. Arbitrary JS execution is not allowed.
 */
export function resolveTemplateString(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9.]*)\s*\}\}/g, (match, key: string) => {
    const value = contextValue(context, key);
    return value === undefined || value === null ? match : String(value);
  });
}

/** Deep-resolve a template definition (strings only). Non-strings pass through. */
export function resolveTemplateValue(value: unknown, context: TemplateContext): unknown {
  if (typeof value === 'string') return resolveTemplateString(value, context);
  if (Array.isArray(value)) return value.map((item) => resolveTemplateValue(item, context));
  if (value !== null && typeof value === 'object') {
    const record: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      record[key] = resolveTemplateValue(item, context);
    }
    return record;
  }
  return value;
}
