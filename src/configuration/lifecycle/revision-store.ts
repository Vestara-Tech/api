import type { ConfigurationScopeLike } from '../domain/types.js';
import { randomId } from '../../core/identifiers.js';

export type ConfigurationRevisionStatus = 'draft' | 'applied' | 'superseded';

export interface ConfigurationRevision {
  readonly id: string;
  readonly scope: ConfigurationScopeLike;
  readonly values: Readonly<Record<string, unknown>>;
  readonly status: ConfigurationRevisionStatus;
  readonly createdAt: string;
  readonly appliedAt?: string;
  readonly appliedBy?: string;
  readonly note?: string;
  readonly parentId?: string;
}

export interface RevisionStore {
  create(revision: Omit<ConfigurationRevision, 'id' | 'status' | 'createdAt'>): Promise<ConfigurationRevision>;
  get(id: string): Promise<ConfigurationRevision | null>;
  listForScope(scope: ConfigurationScopeLike): Promise<readonly ConfigurationRevision[]>;
  markApplied(id: string, appliedBy?: string): Promise<ConfigurationRevision | null>;
  markSuperseded(id: string): Promise<ConfigurationRevision | null>;
}

export class InMemoryRevisionStore implements RevisionStore {
  private readonly revisions = new Map<string, ConfigurationRevision>();

  async create(input: Omit<ConfigurationRevision, 'id' | 'status' | 'createdAt'>): Promise<ConfigurationRevision> {
    const revision: ConfigurationRevision = {
      ...input,
      id: randomId('rev'),
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    this.revisions.set(revision.id, revision);
    return revision;
  }

  async get(id: string): Promise<ConfigurationRevision | null> {
    return this.revisions.get(id) ?? null;
  }

  async listForScope(scope: ConfigurationScopeLike): Promise<readonly ConfigurationRevision[]> {
    return [...this.revisions.values()]
      .filter((r) => r.scope === scope)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async markApplied(id: string, appliedBy?: string): Promise<ConfigurationRevision | null> {
    const revision = this.revisions.get(id);
    if (!revision) return null;
    const updated: ConfigurationRevision = {
      ...revision,
      status: 'applied',
      appliedAt: new Date().toISOString(),
      ...(appliedBy !== undefined ? { appliedBy } : {}),
    };
    this.revisions.set(id, updated);
    return updated;
  }

  async markSuperseded(id: string): Promise<ConfigurationRevision | null> {
    const revision = this.revisions.get(id);
    if (!revision) return null;
    const updated: ConfigurationRevision = { ...revision, status: 'superseded' };
    this.revisions.set(id, updated);
    return updated;
  }
}
