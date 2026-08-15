import type { ThemeDefinition } from '../domain/theme-definition.js';

function base(id: string, name: string, mode: ThemeDefinition['mode'], tokens: ThemeDefinition['tokens']): ThemeDefinition {
  return {
    id,
    name,
    version: '1.0.0',
    mode,
    tokens,
    typography: { fontFamily: '"Inter", "Roboto", sans-serif', fontSizeScale: 1.25, baseSizePx: 14, headingWeight: 600, bodyWeight: 400, lineHeight: 1.5 },
    spacing: { scale: [4, 8, 12, 16, 24, 32, 48], basePx: 4 },
    radius: { small: 4, medium: 8, large: 12, full: 999 },
    elevation: { levels: ['none', '0 1px 2px rgba(0,0,0,0.1)', '0 4px 8px rgba(0,0,0,0.12)', '0 12px 24px rgba(0,0,0,0.16)'] },
    motion: { durationFastMs: 120, durationMediumMs: 240, durationSlowMs: 400, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    components: {},
    assets: {},
    metadata: { tags: ['builtin'], mode },
  };
}

export function builtinThemes(): readonly ThemeDefinition[] {
  return [
    base('vestara.light', 'Vestara Light', 'light', {
      'color.background.canvas': '#f5f5f7',
      'color.background.surface': '#ffffff',
      'color.background.elevated': '#ffffff',
      'color.text.primary': '#1a1a1a',
      'color.text.secondary': '#5a5a5e',
      'color.text.disabled': '#9a9aa0',
      'color.border.default': '#e3e3e8',
      'color.border.strong': '#c4c4cc',
      'color.brand.primary': '#B89B5E',
      'color.brand.secondary': '#4a4a55',
      'color.status.success': '#2e7d32',
      'color.status.warning': '#ed6c02',
      'color.status.error': '#d32f2f',
      'color.status.info': '#0288d1',
    }),
    base('vestara.dark', 'Vestara Dark', 'dark', {
      'color.background.canvas': '#121216',
      'color.background.surface': '#1e1e24',
      'color.background.elevated': '#2a2a32',
      'color.text.primary': '#ececf1',
      'color.text.secondary': '#a0a0ab',
      'color.text.disabled': '#6a6a75',
      'color.border.default': '#33333d',
      'color.border.strong': '#4a4a55',
      'color.brand.primary': '#B89B5E',
      'color.brand.secondary': '#8a8a99',
      'color.status.success': '#4caf50',
      'color.status.warning': '#fb8c00',
      'color.status.error': '#f44336',
      'color.status.info': '#29b6f6',
    }),
  ];
}
