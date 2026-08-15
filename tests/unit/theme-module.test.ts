import { describe, expect, it } from 'vitest';
import {
  ThemeService,
  ThemeRegistry,
  ThemeScopeResolver,
  THEME_SCOPE_PRECEDENCE,
  validateTheme,
  toMuiTheme,
  toCssRules,
  osThemeContribution,
  builtinThemes,
  type ThemeDefinition,
} from '../../src/theme/index.js';

function theme(id: string, overrides: Partial<ThemeDefinition> = {}): ThemeDefinition {
  return {
    id,
    name: `Theme ${id}`,
    version: '1.0.0',
    mode: 'light',
    tokens: {
      'color.brand.primary': '#B89B5E',
      'color.background.canvas': '#f5f5f7',
      'color.background.surface': '#ffffff',
      'color.text.primary': '#1a1a1a',
    },
    typography: { fontFamily: 'Inter', fontSizeScale: 1.25, baseSizePx: 14, headingWeight: 600, bodyWeight: 400, lineHeight: 1.5 },
    spacing: { scale: [4, 8, 12], basePx: 4 },
    radius: { small: 4, medium: 8, large: 12, full: 999 },
    elevation: { levels: ['none', 'shadow'] },
    motion: { durationFastMs: 120, durationMediumMs: 240, durationSlowMs: 400, easing: 'ease' },
    components: {},
    assets: { wallpaper: 'wall.png' },
    metadata: { tags: [], mode: 'light' },
    ...overrides,
  };
}

describe('THEME-001..005 theme definition', () => {
  it('ships built-in light + dark themes with semantic tokens', () => {
    const themes = builtinThemes();
    expect(themes.some((t) => t.id === 'vestara.light')).toBe(true);
    expect(themes.some((t) => t.id === 'vestara.dark')).toBe(true);
    const dark = themes.find((t) => t.id === 'vestara.dark')!;
    expect(dark.tokens['color.background.canvas']).toBe('#121216');
    expect(dark.metadata.mode).toBe('dark');
  });
});

describe('THEME-007 registry + service', () => {
  it('registers and lists themes', () => {
    const service = new ThemeService();
    service.register(theme('custom'));
    expect(service.get('custom').name).toContain('custom');
    expect(service.list().length).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid themes', () => {
    const service = new ThemeService();
    const bad = theme('bad', { typography: { ...theme('x').typography, fontFamily: '' } });
    expect(() => service.register(bad)).toThrow(/Invalid theme/);
  });

  it('lists by mode', () => {
    const registry = new ThemeRegistry();
    registry.register(theme('a'));
    registry.register(theme('b', { mode: 'dark' }));
    expect(registry.listByMode('dark')).toHaveLength(1);
  });
});

describe('THEME-006 scope resolver', () => {
  it('resolves hierarchical themes with correct precedence', () => {
    const registry = new ThemeRegistry();
    registry.register(theme('system-theme', { tokens: { 'color.brand.primary': '#000000' } }));
    registry.register(theme('workspace-theme', { tokens: { 'color.brand.primary': '#B89B5E' } }));
    const resolver = new ThemeScopeResolver({
      bindings: [
        { scope: 'system', scopeId: 'sys', themeId: 'system-theme' },
        { scope: 'workspace', scopeId: 'ws', themeId: 'workspace-theme' },
      ],
      resolveTheme: (id) => registry.get(id),
    });
    const resolved = resolver.resolve([
      { scope: 'system', scopeId: 'sys' },
      { scope: 'workspace', scopeId: 'ws' },
    ]);
    expect(resolved!.id).toBe('workspace-theme');
    expect(resolved!.tokens['color.brand.primary']).toBe('#B89B5E');
  });

  it('honors precedence order constant', () => {
    expect(THEME_SCOPE_PRECEDENCE[0]).toBe('system');
    expect(THEME_SCOPE_PRECEDENCE.at(-1)).toBe('component');
  });
});

describe('THEME-008 validation', () => {
  it('flags non-hex tokens as warnings and missing identity as errors', () => {
    const result = validateTheme(theme('x', { tokens: { 'color.brand.primary': 'not-a-color' } }));
    expect(result.ok).toBe(true); // warnings only
    expect(result.issues.some((i) => i.severity === 'warning' && i.message.includes('hex color'))).toBe(true);

    const bad = validateTheme(theme('', {}));
    expect(bad.ok).toBe(false);
  });
});

describe('THEME-010/011 adapters', () => {
  it('compiles to a MUI theme object', () => {
    const mui = toMuiTheme(theme('a'));
    expect(mui.palette.primary.main).toBe('#B89B5E');
    expect(mui.palette.background.default).toBe('#f5f5f7');
    expect(mui.spacing(2)).toBe(8);
    expect(mui.typography.fontFamily).toBe('Inter');
  });

  it('compiles to CSS custom properties', () => {
    const css = toCssRules(theme('a'));
    expect(css).toContain('--vestara-color-brand-primary: #B89B5E');
    expect(css).toContain('--vestara-font-family');
  });
});

describe('THEME-014 OS contribution', () => {
  it('maps a theme to GRUB/Plymouth/login/desktop', () => {
    const contribution = osThemeContribution(theme('a'));
    expect(contribution.grub.colorNormal).toBe('#B89B5E');
    expect(contribution.plymouth.theme).toBe('a');
    expect(contribution.desktop.wallpaper).toBe('wall.png');
    expect(contribution.shell.accent).toBe('#ffffff');
  });
});
