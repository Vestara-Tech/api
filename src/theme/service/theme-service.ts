import { conflict, notFound } from '../../core/errors.js';
import type { ThemeDefinition, ThemeMode } from '../domain/theme-definition.js';
import type { ThemeRegistryPort } from '../registry/theme-registry.js';
import { InMemoryThemeRegistry } from '../registry/theme-registry.js';
import { validateTheme } from '../domain/theme-scope.js';

export interface ThemeServiceOptions {
  readonly registry?: ThemeRegistryPort;
}

/** THEME — Theme service. Owns themes: register, list, resolve, validate. */
export class ThemeService {
  private readonly registry: ThemeRegistryPort;

  constructor(options: ThemeServiceOptions = {}) {
    this.registry = options.registry ?? new InMemoryThemeRegistry();
  }

  register(theme: ThemeDefinition): ThemeDefinition {
    const validation = validateTheme(theme);
    if (!validation.ok) throw conflict(`Invalid theme: ${validation.issues.map((i) => i.message).join('; ')}`);
    this.registry.register(theme);
    return theme;
  }

  get(id: string): ThemeDefinition {
    const theme = this.registry.get(id);
    if (!theme) throw notFound(`Theme "${id}" not found`);
    return theme;
  }

  list(): readonly ThemeDefinition[] {
    return this.registry.list();
  }

  listByMode(mode: ThemeMode): readonly ThemeDefinition[] {
    return this.registry.list().filter((t) => t.mode === mode);
  }

  resolve(id: string): ThemeDefinition | undefined {
    return this.registry.get(id);
  }
}
