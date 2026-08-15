import type { Session } from '../domain/session.js';
import type { SessionStore } from './session-store.js';

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();

  async create(session: Session): Promise<Session> {
    this.sessions.set(session.id, session);
    return session;
  }

  async get(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null;
  }

  async listForIdentity(identityId: string): Promise<readonly Session[]> {
    return [...this.sessions.values()]
      .filter((s) => s.identityId === identityId)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  async save(session: Session): Promise<Session> {
    this.sessions.set(session.id, session);
    return session;
  }

  async remove(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }
}
