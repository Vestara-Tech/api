import { ThemeService } from '../theme/service/theme-service.js';
import { builtinThemes } from '../theme/contributions/builtin.js';

export interface ThemePlatform {
  readonly service: ThemeService;
}

/** THEME — Composition root. Registers built-in light + dark themes. */
export function buildThemePlatform(): ThemePlatform {
  const service = new ThemeService();
  for (const theme of builtinThemes()) service.register(theme);
  return { service };
}
