import type { Identity } from '../domain/identity.js';

export interface IdentityStore {
  create(identity: Identity): Promise<Identity>;
  get(id: string): Promise<Identity | null>;
  getByExternal(subjectKey: string): Promise<Identity | null>;
  save(identity: Identity): Promise<Identity>;
  list(): Promise<readonly Identity[]>;
  indexExternal(identityId: string, subjectKey: string): Promise<void>;
}
