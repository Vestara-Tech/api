import type { ApiDefinition, ApiDefinitionRevision } from '../domain/types.js';
import type { DraftStore } from './draft-store.js';

export class InMemoryDraftStore implements DraftStore {
  private readonly definitions = new Map<string, ApiDefinition>();
  private readonly revisions = new Map<string, ApiDefinitionRevision[]>();

  async create(definition: ApiDefinition): Promise<ApiDefinition> {
    this.definitions.set(definition.id, definition);
    return definition;
  }

  async get(id: string): Promise<ApiDefinition | null> {
    return this.definitions.get(id) ?? null;
  }

  async list(): Promise<readonly ApiDefinition[]> {
    return [...this.definitions.values()];
  }

  async save(definition: ApiDefinition): Promise<ApiDefinition> {
    this.definitions.set(definition.id, definition);
    return definition;
  }

  async remove(id: string): Promise<boolean> {
    return this.definitions.delete(id);
  }

  async recordRevision(revision: ApiDefinitionRevision): Promise<void> {
    const existing = this.revisions.get(revision.definition.id) ?? [];
    existing.push(revision);
    this.revisions.set(revision.definition.id, existing);
  }

  async listRevisions(id: string): Promise<readonly ApiDefinitionRevision[]> {
    return this.revisions.get(id) ?? [];
  }
}
