import type { Credential } from '../domain/credential.js';
import type { CredentialStore } from './credential-store.js';

export class InMemoryCredentialStore implements CredentialStore {
  private readonly credentials = new Map<string, Credential>();

  async create(credential: Credential): Promise<Credential> {
    this.credentials.set(credential.id, credential);
    return credential;
  }

  async get(id: string): Promise<Credential | null> {
    return this.credentials.get(id) ?? null;
  }

  async listForIdentity(identityId: string): Promise<readonly Credential[]> {
    return [...this.credentials.values()].filter((c) => c.identityId === identityId);
  }

  async getByKindForIdentity(identityId: string, kind: string): Promise<Credential | null> {
    return (
      [...this.credentials.values()].find((c) => c.identityId === identityId && c.kind === kind) ?? null
    );
  }

  async save(credential: Credential): Promise<Credential> {
    this.credentials.set(credential.id, credential);
    return credential;
  }
}
