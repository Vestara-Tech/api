import type {
  SemanticTokenDraft,
  ThemeDraftValidationResult,
  ThemeDraftValidationIssue,
  ThemeMode,
} from './generation.js';
import type {
  ThemeDefinition,
  ThemeTokens,
  TypographyDefinition,
  SpacingDefinition,
  RadiusDefinition,
  ElevationDefinition,
  MotionDefinition,
  ComponentThemeOverride,
  ThemeAssets,
  ThemeMetadata,
} from './theme-definition.js';

const REQUIRED_COLOR_TOKENS: (keyof ThemeTokens)[] = [
  'color.background.canvas',
  'color.background.surface',
  'color.text.primary',
  'color.text.secondary',
  'color.brand.primary',
  'color.status.success',
  'color.status.warning',
  'color.status.error',
];

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function isValidHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value);
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  if (!isValidHexColor(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function getLuminance(r: number, g: number, b: number): number {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function getContrastRatio(color1: string, color2: string): number | null {
  const c1 = parseHexColor(color1);
  const c2 = parseHexColor(color2);
  if (!c1 || !c2) return null;
  const l1 = getLuminance(c1.r, c1.g, c1.b);
  const l2 = getLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function checkValidColor(value: string): string {
  const parsed = parseHexColor(value);
  if (!parsed) throw new Error(`Invalid hex color: ${value}`);
  return value;
}

function checkContrast(textColor: string, bgColor: string, level: 'AA' | 'AAA', isLargeText: boolean): { pass: boolean; ratio: number | null } {
  const ratio = getContrastRatio(textColor, bgColor);
  if (ratio === null) return { pass: false, ratio: null };
  const required = level === 'AAA' ? (isLargeText ? 4.5 : 7) : (isLargeText ? 3 : 4.5);
  return { pass: ratio >= required, ratio };
}

function validateColorTokens(colors: Partial<ThemeTokens>, level: 'AA' | 'AAA'): ThemeDraftValidationIssue[] {
  const issues: ThemeDraftValidationIssue[] = [];

  for (const [key, value] of Object.entries(colors) as [string, string | undefined][]) {
    if (value === undefined) continue;
    if (!isValidHexColor(value)) {
      issues.push({
        path: `colors.${key}`,
        message: `Color token "${key}" must be a valid 6-digit hex color (e.g., #1a2b3c), received: ${value}`,
        severity: 'error',
        code: 'INVALID_HEX_COLOR',
      });
    }
  }

  const canvas = colors['color.background.canvas'];
  const surface = colors['color.background.surface'];
  const textPrimary = colors['color.text.primary'];
  const textSecondary = colors['color.text.secondary'];

  if (canvas && textPrimary) {
    const result = checkContrast(textPrimary, canvas, level, false);
    if (!result.pass) {
      issues.push({
        path: 'colors.color.text.primary',
        message: `Insufficient contrast between text.primary (${textPrimary}) and background.canvas (${canvas}): ${result.ratio?.toFixed(2) ?? 'N/A'} (required ${level === 'AAA' ? '7:1' : '4.5:1'} for normal text)`,
        severity: 'error',
        code: 'CONTRAST_FAILURE',
      });
    }
  }

  if (surface && textSecondary) {
    const result = checkContrast(textSecondary, surface, level, false);
    if (!result.pass) {
      issues.push({
        path: 'colors.color.text.secondary',
        message: `Insufficient contrast between text.secondary (${textSecondary}) and background.surface (${surface}): ${result.ratio?.toFixed(2) ?? 'N/A'} (required ${level === 'AAA' ? '7:1' : '4.5:1'} for normal text)`,
        severity: 'warning',
        code: 'CONTRAST_WARNING',
      });
    }
  }

  const brandPrimary = colors['color.brand.primary'];
  if (canvas && brandPrimary) {
    const result = checkContrast(brandPrimary, canvas, level, true);
    if (!result.pass) {
      issues.push({
        path: 'colors.color.brand.primary',
        message: `Brand primary (${brandPrimary}) may have insufficient contrast on canvas (${canvas}) for large text: ${result.ratio?.toFixed(2) ?? 'N/A'}`,
        severity: 'warning',
        code: 'CONTRAST_WARNING',
      });
    }
  }

  return issues;
}

function validateTypography(typography: Partial<TypographyDefinition>): ThemeDraftValidationIssue[] {
  const issues: ThemeDraftValidationIssue[] = [];
  if (typography.fontFamily !== undefined && typography.fontFamily.trim().length === 0) {
    issues.push({ path: 'typography.fontFamily', message: 'Font family cannot be empty', severity: 'error', code: 'EMPTY_FONT_FAMILY' });
  }
  if (typography.fontSizeScale !== undefined && (typography.fontSizeScale <= 0 || typography.fontSizeScale > 3)) {
    issues.push({ path: 'typography.fontSizeScale', message: 'Font size scale must be between 0 and 3', severity: 'error', code: 'INVALID_FONT_SCALE' });
  }
  if (typography.baseSizePx !== undefined && (typography.baseSizePx < 8 || typography.baseSizePx > 32)) {
    issues.push({ path: 'typography.baseSizePx', message: 'Base size must be between 8 and 32px', severity: 'error', code: 'INVALID_BASE_SIZE' });
  }
  if (typography.headingWeight !== undefined && (typography.headingWeight < 100 || typography.headingWeight > 900 || typography.headingWeight % 100 !== 0)) {
    issues.push({ path: 'typography.headingWeight', message: 'Heading weight must be a valid CSS font weight (100-900, multiples of 100)', severity: 'error', code: 'INVALID_FONT_WEIGHT' });
  }
  if (typography.bodyWeight !== undefined && (typography.bodyWeight < 100 || typography.bodyWeight > 900 || typography.bodyWeight % 100 !== 0)) {
    issues.push({ path: 'typography.bodyWeight', message: 'Body weight must be a valid CSS font weight (100-900, multiples of 100)', severity: 'error', code: 'INVALID_FONT_WEIGHT' });
  }
  if (typography.lineHeight !== undefined && (typography.lineHeight < 1 || typography.lineHeight > 3)) {
    issues.push({ path: 'typography.lineHeight', message: 'Line height must be between 1 and 3', severity: 'error', code: 'INVALID_LINE_HEIGHT' });
  }
  return issues;
}

function validateSpacing(spacing: Partial<SpacingDefinition>): ThemeDraftValidationIssue[] {
  const issues: ThemeDraftValidationIssue[] = [];
  if (spacing.basePx !== undefined && (spacing.basePx <= 0 || spacing.basePx > 16)) {
    issues.push({ path: 'spacing.basePx', message: 'Spacing base must be between 1 and 16px', severity: 'error', code: 'INVALID_SPACING_BASE' });
  }
  if (spacing.scale !== undefined) {
    if (!Array.isArray(spacing.scale) || spacing.scale.length === 0) {
      issues.push({ path: 'spacing.scale', message: 'Spacing scale must be a non-empty array', severity: 'error', code: 'INVALID_SPACING_SCALE' });
    } else {
      for (let i = 0; i < spacing.scale.length; i++) {
        if (typeof spacing.scale[i] !== 'number' || spacing.scale[i] <= 0) {
          issues.push({ path: `spacing.scale[${i}]`, message: 'Spacing scale values must be positive numbers', severity: 'error', code: 'INVALID_SPACING_VALUE' });
        }
      }
    }
  }
  return issues;
}

function validateRadius(radius: Partial<RadiusDefinition>): ThemeDraftValidationIssue[] {
  const issues: ThemeDraftValidationIssue[] = [];
  const keys: (keyof RadiusDefinition)[] = ['small', 'medium', 'large', 'full'];
  for (const key of keys) {
    const value = radius[key];
    const keyStr = String(key);
    if (value !== undefined && (value < 0 || value > 9999)) {
      issues.push({ path: `radius.${keyStr}`, message: `Radius ${keyStr} must be between 0 and 9999`, severity: 'error', code: 'INVALID_RADIUS' });
    }
  }
  return issues;
}

function validateElevation(elevation: Partial<ElevationDefinition>): ThemeDraftValidationIssue[] {
  const issues: ThemeDraftValidationIssue[] = [];
  if (elevation.levels !== undefined) {
    if (!Array.isArray(elevation.levels) || elevation.levels.length === 0) {
      issues.push({ path: 'elevation.levels', message: 'Elevation levels must be a non-empty array', severity: 'error', code: 'INVALID_ELEVATION_LEVELS' });
    }
  }
  return issues;
}

function validateMotion(motion: Partial<MotionDefinition>): ThemeDraftValidationIssue[] {
  const issues: ThemeDraftValidationIssue[] = [];
  const durationKeys: (keyof MotionDefinition)[] = ['durationFastMs', 'durationMediumMs', 'durationSlowMs'];
  for (const key of durationKeys) {
    const value = motion[key];
    const keyStr = String(key);
    if (typeof value === 'number' && (value < 0 || value > 5000)) {
      issues.push({ path: `motion.${keyStr}`, message: `Motion ${keyStr} must be between 0 and 5000ms`, severity: 'error', code: 'INVALID_DURATION' });
    }
  }
  if (motion.easing !== undefined && typeof motion.easing !== 'string') {
    issues.push({ path: 'motion.easing', message: 'Easing must be a string', severity: 'error', code: 'INVALID_EASING' });
  }
  return issues;
}

function validateComponents(components: Partial<Record<string, ComponentThemeOverride>>): ThemeDraftValidationIssue[] {
  const issues: ThemeDraftValidationIssue[] = [];
  if (components) {
    for (const [componentName, override] of Object.entries(components)) {
      if (override && typeof override !== 'object') {
        issues.push({ path: `components.${componentName}`, message: 'Component override must be an object', severity: 'error', code: 'INVALID_COMPONENT_OVERRIDE' });
      }
      if (override?.props && typeof override.props !== 'object') {
        issues.push({ path: `components.${componentName}.props`, message: 'Component props must be an object', severity: 'error', code: 'INVALID_COMPONENT_PROPS' });
      }
      if (override?.styles && typeof override.styles !== 'object') {
        issues.push({ path: `components.${componentName}.styles`, message: 'Component styles must be an object', severity: 'error', code: 'INVALID_COMPONENT_STYLES' });
      }
    }
  }
  return issues;
}

function validateAssets(assets: Partial<ThemeAssets>): ThemeDraftValidationIssue[] {
  const issues: ThemeDraftValidationIssue[] = [];
  if (assets) {
    for (const [key, value] of Object.entries(assets)) {
      if (value !== undefined && typeof value !== 'string') {
        issues.push({ path: `assets.${key}`, message: `Asset ${key} must be a string`, severity: 'error', code: 'INVALID_ASSET' });
      }
    }
  }
  return issues;
}

function validateMetadata(metadata: Partial<ThemeMetadata>): ThemeDraftValidationIssue[] {
  const issues: ThemeDraftValidationIssue[] = [];
  if (metadata.mode !== undefined && !['light', 'dark', 'adaptive'].includes(metadata.mode)) {
    issues.push({ path: 'metadata.mode', message: 'Mode must be "light", "dark", or "adaptive"', severity: 'error', code: 'INVALID_MODE' });
  }
  if (metadata.tags !== undefined && (!Array.isArray(metadata.tags) || metadata.tags.some((t) => typeof t !== 'string'))) {
    issues.push({ path: 'metadata.tags', message: 'Tags must be an array of strings', severity: 'error', code: 'INVALID_TAGS' });
  }
  return issues;
}

function correctDraft(draft: SemanticTokenDraft, issues: ThemeDraftValidationIssue[]): SemanticTokenDraft {
  const corrected = { ...draft };
  for (const issue of issues) {
    if (issue.severity === 'error' && issue.code === 'INVALID_HEX_COLOR') {
      const pathParts = issue.path.split('.');
      if (pathParts[0] === 'colors' && pathParts[1]) {
        const colorKey = pathParts.slice(1).join('.');
        if (corrected.colors && corrected.colors[colorKey as keyof ThemeTokens]) {
          corrected.colors = { ...corrected.colors, [colorKey]: '#000000' } as Partial<ThemeTokens>;
        }
      }
    }
  }
  return corrected;
}

export function validateThemeDraft(
  draft: SemanticTokenDraft,
  options: { accessibilityLevel?: 'AA' | 'AAA'; mode?: ThemeMode } = {}
): ThemeDraftValidationResult {
  const { accessibilityLevel = 'AA', mode = 'light' } = options;
  const allIssues: ThemeDraftValidationIssue[] = [];

  allIssues.push(...validateColorTokens(draft.colors ?? {}, accessibilityLevel));
  allIssues.push(...validateTypography(draft.typography ?? {}));
  allIssues.push(...validateSpacing(draft.spacing ?? {}));
  allIssues.push(...validateRadius(draft.radius ?? {}));
  allIssues.push(...validateElevation(draft.elevation ?? {}));
  allIssues.push(...validateMotion(draft.motion ?? {}));
  allIssues.push(...validateComponents(draft.components ?? {}));
  allIssues.push(...validateAssets(draft.assets ?? {}));
  allIssues.push(...validateMetadata(draft.metadata ?? {}));

  for (const required of REQUIRED_COLOR_TOKENS) {
    if (!draft.colors?.[required]) {
      allIssues.push({
        path: `colors.${required}`,
        message: `Required color token "${required}" is missing`,
        severity: 'warning',
        code: 'MISSING_REQUIRED_TOKEN',
      });
    }
  }

  const hasErrors = allIssues.some((i) => i.severity === 'error');
  const correctedDraft = hasErrors ? correctDraft(draft, allIssues) : undefined;

  return {
    ok: !hasErrors,
    issues: allIssues,
    ...(correctedDraft !== undefined ? { correctedDraft } : {}),
  };
}

export function validateThemeDraftForTheme(
  draft: SemanticTokenDraft,
  baseTheme: ThemeDefinition,
  options: { accessibilityLevel?: 'AA' | 'AAA' } = {}
): ThemeDraftValidationResult {
  const opts: { accessibilityLevel?: 'AA' | 'AAA'; mode?: ThemeMode } = { mode: baseTheme.mode };
  if (options.accessibilityLevel !== undefined) {
    opts.accessibilityLevel = options.accessibilityLevel;
  }
  const result = validateThemeDraft(draft, opts);
  return result;
}