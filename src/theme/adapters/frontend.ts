/** THEME-010/011 — Frontend adapters: MUI + CSS custom properties. */

import type { ThemeDefinition } from '../domain/theme-definition.js';

export interface MuiThemeAdapterOutput {
  readonly palette: {
    readonly mode: ThemeDefinition['mode'];
    readonly primary: { main: string };
    readonly secondary: { main: string };
    readonly success: { main: string };
    readonly warning: { main: string };
    readonly error: { main: string };
    readonly info: { main: string };
    readonly background: { default: string; paper: string };
    readonly text: { primary: string; secondary: string; disabled: string };
    readonly divider: string;
  };
  readonly typography: {
    readonly fontFamily: string;
    readonly htmlFontSize: number;
    readonly h1: { fontWeight: number };
    readonly body1: { fontWeight: number; lineHeight: number };
  };
  readonly shape: { borderRadius: number };
  readonly spacing: (factor: number) => number;
}

/**
 * THEME-010 — MUI adapter. Compiles semantic theme tokens into a MUI Theme
 * object. Semantic tokens stay frontend-library-independent; only the adapter
 * knows MUI.
 */
export function toMuiTheme(theme: ThemeDefinition): MuiThemeAdapterOutput {
  const t = theme.tokens;
  return {
    palette: {
      mode: theme.mode,
      primary: { main: t['color.brand.primary'] ?? '#000000' },
      secondary: { main: t['color.brand.secondary'] ?? '#666666' },
      success: { main: t['color.status.success'] ?? '#2e7d32' },
      warning: { main: t['color.status.warning'] ?? '#ed6c02' },
      error: { main: t['color.status.error'] ?? '#d32f2f' },
      info: { main: t['color.status.info'] ?? '#0288d1' },
      background: {
        default: t['color.background.canvas'] ?? '#ffffff',
        paper: t['color.background.surface'] ?? '#fafafa',
      },
      text: {
        primary: t['color.text.primary'] ?? '#111111',
        secondary: t['color.text.secondary'] ?? '#555555',
        disabled: t['color.text.disabled'] ?? '#999999',
      },
      divider: t['color.border.default'] ?? '#e0e0e0',
    },
    typography: {
      fontFamily: theme.typography.fontFamily,
      htmlFontSize: theme.typography.baseSizePx,
      h1: { fontWeight: theme.typography.headingWeight },
      body1: { fontWeight: theme.typography.bodyWeight, lineHeight: theme.typography.lineHeight },
    },
    shape: { borderRadius: theme.radius.medium },
    spacing: (factor: number): number => factor * theme.spacing.basePx,
  };
}

/**
 * THEME-011 — CSS custom properties adapter. Compiles tokens into
 * `--vestara-*` CSS custom properties for Tailwind/CSS consumption.
 */
export function toCssVariables(theme: ThemeDefinition): Readonly<Record<string, string>> {
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme.tokens)) {
    if (value !== undefined) variables[`--vestara-${key.replace(/\./g, '-')}`] = value;
  }
  variables['--vestara-font-family'] = theme.typography.fontFamily;
  variables['--vestara-radius-medium'] = `${theme.radius.medium}px`;
  variables['--vestara-spacing-base'] = `${theme.spacing.basePx}px`;
  variables['--vestara-motion-fast'] = `${theme.motion.durationFastMs}ms`;
  return variables;
}

export function toCssRules(theme: ThemeDefinition): string {
  const variables = toCssVariables(theme);
  const lines = Object.entries(variables).map(([key, value]) => `  ${key}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}`;
}
