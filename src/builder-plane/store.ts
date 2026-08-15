import { conflict, notFound } from '../core/errors.js';
import type { BuilderDefinition, CreateBuilderDefinitionInput } from './contracts.js';

export interface BuilderRevision<TKind extends string = string, TSpec = unknown> {
  readonly revision: number;
  readonly definition: BuilderDefinition<TKind, TSpec>;
  readonly recordedAt: string;
}

/**
 * BLD-X05/06 — generic builder store + revision history. Kind-agnostic;
 * API/Agent/Workflow/Database definitions all use the same lifecycle.
 */
export class BuilderStore {
  private readonly definitions = new Map<string, BuilderDefinition>();
  private readonly revisions = new Map<string, BuilderRevision[]>();

  create<TKind extends string, TSpec>(input: CreateBuilderDefinitionInput<TKind, TSpec>): BuilderDefinition<TKind, TSpec> {
    if (this.definitions.has(input.id)) throw conflict(`Builder definition "${input.id}" already exists`);
    const now = new Date().toISOString();
    const definition: BuilderDefinition<TKind, TSpec> = {
      id: input.id,
      kind: input.kind,
      name: input.name,
      revision: 0,
      status: 'draft',
      spec: input.spec,
      metadata: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.author !== undefined ? { author: input.author } : {}),
        createdAt: now,
        updatedAt: now,
      },
    };
    this.definitions.set(input.id, definition);
    return definition;
  }

  get<TKind extends string = string, TSpec = unknown>(id: string): BuilderDefinition<TKind, TSpec> {
    const definition = this.definitions.get(id);
    if (!definition) throw notFound(`Builder definition "${id}" not found`);
    return definition as BuilderDefinition<TKind, TSpec>;
  }

  save<TKind extends string, TSpec>(definition: BuilderDefinition<TKind, TSpec>): BuilderDefinition<TKind, TSpec> {
    const updated: BuilderDefinition<TKind, TSpec> = {
      ...definition,
      metadata: { ...definition.metadata, updatedAt: new Date().toISOString() },
    };
    this.definitions.set(definition.id, updated);
    return updated;
  }

  list(kind?: string): readonly BuilderDefinition[] {
    const all = [...this.definitions.values()].sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt));
    return kind !== undefined ? all.filter((d) => d.kind === kind) : all;
  }

  recordRevision(definition: BuilderDefinition): BuilderRevision {
    const list = this.revisions.get(definition.id) ?? [];
    const revision: BuilderRevision = { revision: definition.revision, definition, recordedAt: new Date().toISOString() };
    list.push(revision);
    this.revisions.set(definition.id, list);
    return revision;
  }

  listRevisions(id: string): readonly BuilderRevision[] {
    return this.revisions.get(id) ?? [];
  }
}
