import type { Credential } from '../domain/credential.js';

export interface CredentialStore {
  create(credential: Credential): Promise<Credential>;
  get(id: string): Promise<Credential | null>;
  listForIdentity(identityId: string): Promise<readonly Credential[]>;
  getByKindForIdentity(identityId: string, kind: string): Promise<Credential | null>;
  save(credential: Credential): Promise<Credential>;
}
