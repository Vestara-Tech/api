import { conflict, notFound } from '../../core/errors.js';
import { ThemeService } from './theme-service.js';
import { InMemoryThemeDraftStore } from '../store/theme-draft-store.js';
import type { ThemeDraftStorePort } from '../store/theme-draft-store.js';
import type { ThemeDraft, ThemeDraftCreateInput, ThemeDraftUpdateInput } from '../domain/theme-draft.js';
import { createThemeDraft, bumpVersion } from '../domain/theme-draft.js';
import type { SemanticTokenDraft } from '../domain/generation.js';
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
} from '../domain/theme-definition.js';

export interface ThemeDraftServiceOptions {
  readonly store?: ThemeDraftStorePort;
  readonly themeService?: ThemeService;
}

export class ThemeDraftService {
  private readonly store: ThemeDraftStorePort;
  private readonly themeService: ThemeService;

  constructor(options: ThemeDraftServiceOptions = {}) {
    this.store = options.store ?? new InMemoryThemeDraftStore();
    this.themeService = options.themeService ?? new ThemeService();
  }

  list(): readonly ThemeDraft[] {
    return this.store.list();
  }

  get(id: string): ThemeDraft {
    return this.store.getOrThrow(id);
  }

  create(input: ThemeDraftCreateInput): ThemeDraft {
    return this.store.create(input);
  }

  update(id: string, input: ThemeDraftUpdateInput): ThemeDraft {
    return this.store.update(id, input);
  }

  delete(id: string): void {
    this.store.delete(id);
  }

  publish(id: string): { themeDraft: ThemeDraft; theme: ThemeDefinition } {
    const themeDraft = this.store.publish(id);

    const theme = this.createThemeFromDraft(themeDraft);
    this.themeService.register(theme);

    return { themeDraft, theme };
  }

  archive(id: string): ThemeDraft {
    return this.store.archive(id);
  }

  private createThemeFromDraft(draft: ThemeDraft): ThemeDefinition {
    const baseTokens = draft.baseThemeId ? this.themeService.get(draft.baseThemeId).tokens : ({} as ThemeTokens);

    return {
      id: `theme_${draft.id}`,
      name: draft.name,
      version: draft.version,
      mode: 'adaptive',
      tokens: { ...baseTokens, ...draft.draft.colors } as ThemeTokens,
      typography: { fontFamily: 'system', fontSizeScale: 1, baseSizePx: 14, headingWeight: 600, bodyWeight: 400, lineHeight: 1.5, ...draft.draft.typography } as TypographyDefinition,
      spacing: { scale: [4, 8, 12, 16, 24, 32], basePx: 4, ...draft.draft.spacing } as SpacingDefinition,
      radius: { small: 4, medium: 8, large: 12, full: 999, ...draft.draft.radius } as RadiusDefinition,
      elevation: { levels: ['none', 'sm', 'md', 'lg'], ...draft.draft.elevation } as ElevationDefinition,
      motion: { durationFastMs: 120, durationMediumMs: 240, durationSlowMs: 400, easing: 'ease', ...draft.draft.motion } as MotionDefinition,
      components: (draft.draft.components ?? {}) as Readonly<Record<string, ComponentThemeOverride>>,
      assets: draft.draft.assets ?? {},
      metadata: { author: 'theme-builder', description: draft.description, tags: ['generated'], mode: 'adaptive', ...draft.draft.metadata } as ThemeMetadata,
    };
  }
}