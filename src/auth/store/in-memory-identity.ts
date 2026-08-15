import type { Identity } from '../domain/identity.js';
import type { IdentityStore } from './identity-store.js';

export class InMemoryIdentityStore implements IdentityStore {
  private readonly identities = new Map<string, Identity>();
  private readonly externalIndex = new Map<string, string>(); // subjectKey → identityId

  async create(identity: Identity): Promise<Identity> {
    this.identities.set(identity.id, identity);
    return identity;
  }

  async get(id: string): Promise<Identity | null> {
    return this.identities.get(id) ?? null;
  }

  async getByExternal(subjectKey: string): Promise<Identity | null> {
    const id = this.externalIndex.get(subjectKey);
    return id !== undefined ? (this.identities.get(id) ?? null) : null;
  }

  async save(identity: Identity): Promise<Identity> {
    this.identities.set(identity.id, identity);
    return identity;
  }

  async list(): Promise<readonly Identity[]> {
    return [...this.identities.values()];
  }

  async indexExternal(identityId: string, subjectKey: string): Promise<void> {
    this.externalIndex.set(subjectKey, identityId);
  }
}
