/** THEME-DRAFT — Theme draft domain model (Theme Builder Phase 2). */

import type { SemanticTokenDraft } from './generation.js';

export type ThemeDraftStatus = 'draft' | 'published' | 'archived';

export interface ThemeDraft {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly draft: SemanticTokenDraft;
  readonly baseThemeId: string | undefined;
  readonly version: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: ThemeDraftStatus;
}

export interface ThemeDraftCreateInput {
  readonly name: string;
  readonly description: string;
  readonly draft: SemanticTokenDraft;
  readonly baseThemeId?: string;
}

export interface ThemeDraftUpdateInput {
  readonly name?: string;
  readonly description?: string;
  readonly draft?: SemanticTokenDraft;
  readonly baseThemeId?: string | null;
  readonly status?: ThemeDraftStatus;
}

export function createThemeDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createThemeDraft(input: ThemeDraftCreateInput): ThemeDraft {
  const now = new Date().toISOString();
  return {
    id: createThemeDraftId(),
    name: input.name,
    description: input.description,
    draft: input.draft,
    baseThemeId: input.baseThemeId,
    version: '0.1.0',
    createdAt: now,
    updatedAt: now,
    status: 'draft',
  };
}

export function bumpVersion(version: string): string {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return '1.0.0';
  }
  const major = parts[0] ?? 1;
  const minor = parts[1] ?? 0;
  const patch = (parts[2] ?? 0) + 1;
  return `${major}.${minor}.${patch}`;
}

export function isThemeDraftPublished(draft: ThemeDraft): boolean {
  return draft.status === 'published';
}

export function isThemeDraftArchived(draft: ThemeDraft): boolean {
  return draft.status === 'archived';
}