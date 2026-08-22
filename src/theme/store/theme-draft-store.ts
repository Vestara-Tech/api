/** THEME-DRAFT-STORE — In-memory theme draft store (Theme Builder Phase 2). */

import { notFound, conflict } from '../../core/errors.js';
import type { ThemeDraft, ThemeDraftCreateInput, ThemeDraftUpdateInput, ThemeDraftStatus } from '../domain/theme-draft.js';
import { createThemeDraft, bumpVersion } from '../domain/theme-draft.js';

export interface ThemeDraftStorePort {
  list(): readonly ThemeDraft[];
  get(id: string): ThemeDraft | undefined;
  getOrThrow(id: string): ThemeDraft;
  create(input: ThemeDraftCreateInput): ThemeDraft;
  update(id: string, input: ThemeDraftUpdateInput): ThemeDraft;
  delete(id: string): void;
  publish(id: string): ThemeDraft;
  archive(id: string): ThemeDraft;
}

export class InMemoryThemeDraftStore implements ThemeDraftStorePort {
  private readonly drafts = new Map<string, ThemeDraft>();

  list(): readonly ThemeDraft[] {
    return [...this.drafts.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id: string): ThemeDraft | undefined {
    return this.drafts.get(id);
  }

  getOrThrow(id: string): ThemeDraft {
    const draft = this.drafts.get(id);
    if (!draft) throw notFound(`Theme draft "${id}" not found`);
    return draft;
  }

  create(input: ThemeDraftCreateInput): ThemeDraft {
    const draft = createThemeDraft(input);
    if (this.drafts.has(draft.id)) throw conflict(`Theme draft "${draft.id}" already exists`);
    this.drafts.set(draft.id, draft);
    return draft;
  }

  update(id: string, input: ThemeDraftUpdateInput): ThemeDraft {
    const existing = this.getOrThrow(id);

    const updatedDraft: ThemeDraft = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      draft: input.draft ?? existing.draft,
      baseThemeId: input.baseThemeId !== undefined ? (input.baseThemeId ?? undefined) : existing.baseThemeId,
      status: input.status ?? existing.status,
      updatedAt: new Date().toISOString(),
    };

    this.drafts.set(id, updatedDraft);
    return updatedDraft;
  }

  delete(id: string): void {
    const draft = this.getOrThrow(id);
    if (draft.status === 'published') {
      throw conflict('Cannot delete a published theme draft. Archive it first.');
    }
    this.drafts.delete(id);
  }

  publish(id: string): ThemeDraft {
    const existing = this.getOrThrow(id);

    if (existing.status === 'published') {
      throw conflict(`Theme draft "${id}" is already published`);
    }
    if (existing.status === 'archived') {
      throw conflict(`Cannot publish an archived theme draft "${id}"`);
    }

    const publishedDraft: ThemeDraft = {
      ...existing,
      version: bumpVersion(existing.version),
      status: 'published',
      updatedAt: new Date().toISOString(),
    };

    this.drafts.set(id, publishedDraft);
    return publishedDraft;
  }

  archive(id: string): ThemeDraft {
    const existing = this.getOrThrow(id);

    if (existing.status === 'archived') {
      throw conflict(`Theme draft "${id}" is already archived`);
    }

    const archivedDraft: ThemeDraft = {
      ...existing,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    };

    this.drafts.set(id, archivedDraft);
    return archivedDraft;
  }
}