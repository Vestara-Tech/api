import type { Session } from '../domain/session.js';

export interface SessionStore {
  create(session: Session): Promise<Session>;
  get(id: string): Promise<Session | null>;
  listForIdentity(identityId: string): Promise<readonly Session[]>;
  save(session: Session): Promise<Session>;
  remove(id: string): Promise<boolean>;
}
