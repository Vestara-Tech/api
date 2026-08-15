/** THEME-014 — OS theme contribution. Maps a Vestara theme to OS presentation. */

import type { ThemeDefinition } from '../domain/theme-definition.js';

export interface OsThemeContribution {
  readonly themeId: string;
  readonly grub: {
    readonly background?: string;
    readonly colorNormal?: string;
    readonly colorHighlight?: string;
    readonly font?: string;
  };
  readonly plymouth: { readonly theme: string; readonly animation?: string };
  readonly login: { readonly background?: string; readonly accent?: string };
  readonly desktop: { readonly wallpaper?: string; readonly accent?: string };
  readonly shell: { readonly accent?: string };
}

/**
 * THEME-014 — OS theme contribution. A Vestara theme optionally maps to GRUB,
 * Plymouth, login, desktop shell and notification appearance. Firmware
 * branding stays separate (different risk boundary).
 */
export function osThemeContribution(theme: ThemeDefinition): OsThemeContribution {
  const primary = theme.tokens['color.brand.primary'] ?? '#000000';
  const surface = theme.tokens['color.background.surface'] ?? '#ffffff';
  return {
    themeId: theme.id,
    grub: {
      ...(theme.tokens['color.brand.primary'] !== undefined ? { colorNormal: primary } : {}),
      ...(theme.tokens['color.status.info'] !== undefined ? { colorHighlight: theme.tokens['color.status.info'] } : {}),
      ...(theme.assets.wallpaper !== undefined ? { background: theme.assets.wallpaper } : {}),
    },
    plymouth: { theme: theme.id, ...(theme.assets.splash !== undefined ? { animation: theme.assets.splash } : {}) },
    login: { ...(theme.tokens['color.background.canvas'] !== undefined ? { background: theme.tokens['color.background.canvas'] } : {}), accent: primary },
    desktop: { ...(theme.assets.wallpaper !== undefined ? { wallpaper: theme.assets.wallpaper } : {}), accent: primary },
    shell: { accent: surface },
  };
}
