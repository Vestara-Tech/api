/** THEME-001..005 — Theme domain contracts. */

export type ThemeMode = 'light' | 'dark' | 'adaptive';

export interface ThemeTokens {
  readonly 'color.background.canvas'?: string;
  readonly 'color.background.surface'?: string;
  readonly 'color.background.elevated'?: string;
  readonly 'color.text.primary'?: string;
  readonly 'color.text.secondary'?: string;
  readonly 'color.text.disabled'?: string;
  readonly 'color.border.default'?: string;
  readonly 'color.border.strong'?: string;
  readonly 'color.brand.primary'?: string;
  readonly 'color.brand.secondary'?: string;
  readonly 'color.status.success'?: string;
  readonly 'color.status.warning'?: string;
  readonly 'color.status.error'?: string;
  readonly 'color.status.info'?: string;
  [key: `color.${string}`]: string | undefined;
}

export interface TypographyDefinition {
  readonly fontFamily: string;
  readonly fontSizeScale: number;
  readonly baseSizePx: number;
  readonly headingWeight: number;
  readonly bodyWeight: number;
  readonly lineHeight: number;
}

export interface SpacingDefinition {
  readonly scale: readonly number[];
  readonly basePx: number;
}

export interface RadiusDefinition {
  readonly small: number;
  readonly medium: number;
  readonly large: number;
  readonly full: number;
}

export interface ElevationDefinition {
  readonly levels: readonly string[]; // shadow definitions
}

export interface MotionDefinition {
  readonly durationFastMs: number;
  readonly durationMediumMs: number;
  readonly durationSlowMs: number;
  readonly easing: string;
}

export interface ComponentThemeOverride {
  readonly props?: Readonly<Record<string, unknown>>;
  readonly styles?: Readonly<Record<string, unknown>>;
}

export interface ThemeAssets {
  readonly logo?: string;
  readonly icon?: string;
  readonly wallpaper?: string;
  readonly splash?: string;
  readonly fontFiles?: readonly string[];
}

export interface ThemeMetadata {
  readonly author?: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly mode: ThemeMode;
}

export interface ThemeDefinition {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly mode: ThemeMode;
  readonly tokens: ThemeTokens;
  readonly typography: TypographyDefinition;
  readonly spacing: SpacingDefinition;
  readonly radius: RadiusDefinition;
  readonly elevation: ElevationDefinition;
  readonly motion: MotionDefinition;
  readonly components: Readonly<Record<string, ComponentThemeOverride>>;
  readonly assets: ThemeAssets;
  readonly metadata: ThemeMetadata;
}
