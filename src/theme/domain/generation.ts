/** THEME-GEN — AI-assisted theme generation contracts (ADR-0050). */

import type { ThemeDefinition, ThemeMode, ThemeTokens, TypographyDefinition, SpacingDefinition, RadiusDefinition, ElevationDefinition, MotionDefinition, ComponentThemeOverride, ThemeAssets, ThemeMetadata } from './theme-definition.js';

export type { ThemeMode };

export interface ThemePromptProfile {
  readonly mode?: ThemeMode;
  readonly brandColors?: readonly string[];
  readonly mood?: 'professional' | 'playful' | 'minimal' | 'bold' | 'warm' | 'cool' | 'dark' | 'light';
  readonly density?: 'compact' | 'comfortable' | 'spacious';
  readonly radiusStyle?: 'sharp' | 'rounded' | 'pill';
  readonly elevationStyle?: 'flat' | 'layered' | 'dramatic';
  readonly motionStyle?: 'subtle' | 'standard' | 'expressive';
  readonly typographyPersonality?: 'geometric' | 'humanist' | 'monospace' | 'editorial' | 'system';
  readonly accessibilityLevel?: 'AA' | 'AAA';
  readonly targetSurface?: 'web' | 'mobile' | 'desktop' | 'os' | 'all';
  readonly constraints?: Readonly<Record<string, unknown>>;
}

export interface ThemeGenerationRequest {
  readonly prompt: string;
  readonly profile?: ThemePromptProfile;
  readonly baseThemeId?: string;
  readonly model?: { readonly provider?: string; readonly model?: string };
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface SemanticTokenDraft {
  readonly colors: Partial<ThemeTokens>;
  readonly typography: Partial<TypographyDefinition>;
  readonly spacing: Partial<SpacingDefinition>;
  readonly radius: Partial<RadiusDefinition>;
  readonly elevation: Partial<ElevationDefinition>;
  readonly motion: Partial<MotionDefinition>;
  readonly components: Partial<Record<string, ComponentThemeOverride>>;
  readonly assets: Partial<ThemeAssets>;
  readonly metadata: Partial<ThemeMetadata>;
}

export interface ThemeProposal {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly mode: ThemeMode;
  readonly draft: SemanticTokenDraft;
  readonly rationale: string;
  readonly confidence: number;
  readonly warnings: readonly string[];
}

export interface ThemePatchProposal {
  readonly targetThemeId: string;
  readonly operations: readonly ThemePatchOperation[];
  readonly rationale: string;
  readonly confidence: number;
}

export type ThemePatchOperation =
  | { readonly op: 'set'; readonly path: string; readonly value: unknown }
  | { readonly op: 'add'; readonly path: string; readonly value: unknown }
  | { readonly op: 'remove'; readonly path: string }
  | { readonly op: 'replace'; readonly path: string; readonly value: unknown };

export interface ThemeGenerationResult {
  readonly proposals: readonly ThemeProposal[];
  readonly patches: readonly ThemePatchProposal[];
  readonly rawResponse?: string;
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly latencyMs: number;
  };
}

export interface ThemeDraftValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
  readonly code: string;
}

export interface ThemeDraftValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ThemeDraftValidationIssue[];
  readonly correctedDraft?: SemanticTokenDraft;
}

export interface ThemeGenerationServiceOptions {
  readonly aiService?: AiGenerationPort;
}

export interface AiGenerationPort {
  generate(request: {
    readonly system: string;
    readonly prompt: string;
    readonly schema: unknown;
    readonly temperature?: number;
    readonly maxTokens?: number;
  }): Promise<{ readonly content: string; readonly usage?: { readonly inputTokens: number; readonly outputTokens: number; readonly latencyMs: number } }>;
}

export function isValidThemeMode(mode: string): mode is ThemeMode {
  return mode === 'light' || mode === 'dark' || mode === 'adaptive';
}

export function createEmptyTokenDraft(): SemanticTokenDraft {
  return {
    colors: {},
    typography: {},
    spacing: {},
    radius: {},
    elevation: {},
    motion: {},
    components: {},
    assets: {},
    metadata: {},
  };
}