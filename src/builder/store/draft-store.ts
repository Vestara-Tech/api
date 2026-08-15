import type { ApiDefinition, ApiDefinitionRevision } from '../domain/types.js';

export interface DraftStore {
  create(definition: ApiDefinition): Promise<ApiDefinition>;
  get(id: string): Promise<ApiDefinition | null>;
  list(): Promise<readonly ApiDefinition[]>;
  save(definition: ApiDefinition): Promise<ApiDefinition>;
  remove(id: string): Promise<boolean>;
  recordRevision(revision: ApiDefinitionRevision): Promise<void>;
  listRevisions(id: string): Promise<readonly ApiDefinitionRevision[]>;
  getRevision(id: string, revision: number): Promise<ApiDefinitionRevision | null>;
}
