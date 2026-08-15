import { notFound, conflict } from '../../core/errors.js';
import { randomId } from '../../core/identifiers.js';
import type { BrowserProfile, BrowserSession, BrowserSessionStatus } from '../contracts.js';

/**
 * BRW-002 — Profile + session managers. Profiles and sessions are separate;
 * agents receive browserProfileId, never raw credentials.
 */
export class BrowserSessionManager {
  private readonly profiles = new Map<string, BrowserProfile>();
  private readonly sessions = new Map<string, BrowserSession>();

  registerProfile(profile: BrowserProfile): BrowserProfile {
    if (this.profiles.has(profile.id)) throw conflict(`Browser profile "${profile.id}" already exists`);
    this.profiles.set(profile.id, profile);
    return profile;
  }

  getProfile(id: string): BrowserProfile {
    const profile = this.profiles.get(id);
    if (!profile) throw notFound(`Browser profile "${id}" not found`);
    return profile;
  }

  listProfiles(): readonly BrowserProfile[] {
    return [...this.profiles.values()];
  }

  createSession(profileId: string, runtime: BrowserProfile['runtime']): BrowserSession {
    const profile = this.getProfile(profileId);
    const session: BrowserSession = {
      id: randomId('bs'),
      profileId: profile.id,
      runtime,
      status: 'created',
      tabs: [],
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string): BrowserSession {
    const session = this.sessions.get(id);
    if (!session) throw notFound(`Browser session "${id}" not found`);
    return session;
  }

  updateSession(id: string, patch: Partial<BrowserSession>): BrowserSession {
    const current = this.getSession(id);
    const next = { ...current, ...patch };
    this.sessions.set(id, next);
    return next;
  }

  setStatus(id: string, status: BrowserSessionStatus): BrowserSession {
    return this.updateSession(id, { status });
  }

  destroySession(id: string): boolean {
    return this.sessions.delete(id);
  }

  listSessions(): readonly BrowserSession[] {
    return [...this.sessions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
