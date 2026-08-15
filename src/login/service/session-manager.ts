import { randomId } from '../../core/identifiers.js';

export type OsSessionStatus = 'starting' | 'active' | 'locked' | 'terminated';

export interface OsSession {
  readonly id: string;
  readonly userId: string;
  readonly status: OsSessionStatus;
  readonly startedAt: string;
}

/**
 * LOGIN-006 — OS session manager. Distinguishes LOGIN (create a new OS
 * session) from LOCK (unlock the existing session).
 */
export class OsSessionManager {
  private readonly sessions = new Map<string, OsSession>();

  createSession(userId: string): OsSession {
    const session: OsSession = { id: randomId('os'), userId, status: 'active', startedAt: new Date().toISOString() };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): OsSession | null {
    return this.sessions.get(id) ?? null;
  }

  currentForUser(userId: string): OsSession | null {
    return [...this.sessions.values()].find((s) => s.userId === userId && s.status === 'active') ?? null;
  }

  lock(id: string): void {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, status: 'locked' });
  }

  unlock(id: string): void {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, status: 'active' });
  }

  terminate(id: string): void {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, status: 'terminated' });
  }
}
