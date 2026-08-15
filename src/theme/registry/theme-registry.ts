import { notFound } from '../../core/errors.js';
import type { ThemeDefinition } from '../domain/theme-definition.js';

export interface ThemeRegistryPort {
  register(theme: ThemeDefinition): void;
  get(id: string): ThemeDefinition | undefined;
  list(): readonly ThemeDefinition[];
}

export class InMemoryThemeRegistry implements ThemeRegistryPort {
  private readonly themes = new Map<string, ThemeDefinition>();

  register(theme: ThemeDefinition): void {
    this.themes.set(theme.id, theme);
  }

  get(id: string): ThemeDefinition | undefined {
    return this.themes.get(id);
  }

  list(): readonly ThemeDefinition[] {
    return [...this.themes.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}

/** THEME-007 — Theme registry. First-party + Marketplace-installed themes. */
export class ThemeRegistry implements ThemeRegistryPort {
  private readonly themes = new Map<string, ThemeDefinition>();

  register(theme: ThemeDefinition): void {
    this.themes.set(theme.id, theme);
  }

  get(id: string): ThemeDefinition | undefined {
    return this.themes.get(id);
  }

  getOrThrow(id: string): ThemeDefinition {
    const theme = this.themes.get(id);
    if (!theme) throw notFound(`Theme "${id}" not found`);
    return theme;
  }

  list(): readonly ThemeDefinition[] {
    return [...this.themes.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listByMode(mode: ThemeDefinition['mode']): readonly ThemeDefinition[] {
    return this.list().filter((t) => t.mode === mode);
  }
}
