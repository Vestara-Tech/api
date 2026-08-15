/** THEME-006/008/009 — Theme scope resolution, validation, revisions. */

import type { ThemeDefinition } from './theme-definition.js';

export type ThemeScope = 'system' | 'organization' | 'workspace' | 'application' | 'page' | 'component';

/** THEME-006 — precedence: system < organization < workspace < application < page < component. */
export const THEME_SCOPE_PRECEDENCE: readonly ThemeScope[] = ['system', 'organization', 'workspace', 'application', 'page', 'component'];

export interface ThemeBinding {
  readonly scope: ThemeScope;
  readonly scopeId: string;
  readonly themeId: string;
}

export interface ThemeResolverOptions {
  readonly bindings?: readonly ThemeBinding[];
  readonly resolveTheme?: (id: string) => ThemeDefinition | undefined;
}

/**
 * THEME-006 — Deterministic hierarchical theme resolution. A component-level
 * override wins over page/application/workspace/organization/system themes.
 */
export class ThemeScopeResolver {
  private readonly bindings: readonly ThemeBinding[];
  private readonly resolveTheme: (id: string) => ThemeDefinition | undefined;

  constructor(options: ThemeResolverOptions = {}) {
    this.bindings = options.bindings ?? [];
    this.resolveTheme = options.resolveTheme ?? (() => undefined);
  }

  /** Resolve the effective theme for a scope chain, honoring precedence. */
  resolve(scopes: readonly { scope: ThemeScope; scopeId: string }[]): ThemeDefinition | undefined {
    // Lower precedence first, so the highest wins.
    const ordered = [...scopes].sort((a, b) => THEME_SCOPE_PRECEDENCE.indexOf(a.scope) - THEME_SCOPE_PRECEDENCE.indexOf(b.scope));
    let resolved: ThemeDefinition | undefined;
    for (const scope of ordered) {
      const binding = this.bindings.find((b) => b.scope === scope.scope && b.scopeId === scope.scopeId);
      if (binding) {
        const theme = this.resolveTheme(binding.themeId);
        if (theme) resolved = theme;
      }
    }
    return resolved;
  }

  listBindings(): readonly ThemeBinding[] {
    return [...this.bindings];
  }
}

export interface ThemeValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface ThemeValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ThemeValidationIssue[];
}

/** THEME-008 — theme validation. Semantic tokens must be well-formed colors. */
export function validateTheme(theme: ThemeDefinition): ThemeValidationResult {
  const issues: ThemeValidationIssue[] = [];
  if (!theme.id) issues.push({ path: 'id', message: 'Theme id is required', severity: 'error' });
  if (!theme.name) issues.push({ path: 'name', message: 'Theme name is required', severity: 'error' });
  if (!theme.version) issues.push({ path: 'version', message: 'Theme version is required', severity: 'error' });
  if (theme.typography.fontFamily.length === 0) issues.push({ path: 'typography.fontFamily', message: 'Font family is required', severity: 'error' });
  if (theme.spacing.basePx <= 0) issues.push({ path: 'spacing.basePx', message: 'Spacing base must be positive', severity: 'error' });

  for (const [key, value] of Object.entries(theme.tokens)) {
    if (value === undefined) continue;
    if (typeof value !== 'string' || !value.startsWith('#')) {
      issues.push({ path: `tokens.${key}`, message: `Token "${key}" must be a hex color (received ${typeof value})`, severity: 'warning' });
    }
  }
  return { ok: issues.every((i) => i.severity !== 'error'), issues };
}

/** THEME-009 — revisions/lifecycle. */
export function bumpThemeRevision(theme: ThemeDefinition, version: string): ThemeDefinition {
  return { ...theme, version, metadata: { ...theme.metadata, tags: theme.metadata.tags } };
}
