import { badRequest, notFound } from '../../core/errors.js';
import { randomId } from '../../core/identifiers.js';
import type { Credential, CredentialKind, PasswordHashing } from '../domain/credential.js';
import type { AssuranceLevel, Session } from '../domain/session.js';
import type { CredentialStore } from '../store/credential-store.js';
import type { IdentityStore } from '../store/identity-store.js';
import type { SessionStore } from '../store/session-store.js';
import type { Identity } from '../domain/identity.js';

export interface AuthenticationServiceOptions {
  readonly identityStore: IdentityStore;
  readonly credentialStore: CredentialStore;
  readonly sessionStore: SessionStore;
  readonly passwords: PasswordHashing;
  readonly sessionTtlSeconds?: number;
}

export interface LoginResult {
  readonly identity: Identity;
  readonly session: Session;
  readonly token: string;
}

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export class AuthenticationService {
  private readonly identityStore: IdentityStore;
  private readonly credentialStore: CredentialStore;
  private readonly sessionStore: SessionStore;
  private readonly passwords: PasswordHashing;
  private readonly sessionTtlSeconds: number;

  constructor(options: AuthenticationServiceOptions) {
    this.identityStore = options.identityStore;
    this.credentialStore = options.credentialStore;
    this.sessionStore = options.sessionStore;
    this.passwords = options.passwords;
    this.sessionTtlSeconds = options.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  }

  async createPasswordCredential(identityId: string, password: string, label?: string): Promise<Credential> {
    await this.getIdentity(identityId);
    const secretHash = await this.passwords.hash(password);
    const credential: Credential = {
      id: randomId('cre'),
      identityId,
      kind: 'password',
      status: 'active',
      secretHash,
      ...(label !== undefined ? { label } : {}),
      createdAt: new Date().toISOString(),
    };
    await this.credentialStore.create(credential);

    const identity = await this.getIdentity(identityId);
    const updated = { ...identity, credentials: [...identity.credentials, credential.id], updatedAt: new Date().toISOString() };
    await this.identityStore.save(updated);
    return credential;
  }

  async loginWithPassword(identityId: string, password: string, device?: string): Promise<LoginResult> {
    const identity = await this.getIdentity(identityId);
    if (identity.status !== 'active') throw badRequest(`Identity is ${identity.status}`);
    const credential = await this.credentialStore.getByKindForIdentity(identityId, 'password');
    if (!credential || credential.status !== 'active' || credential.secretHash === undefined) {
      throw badRequest('Invalid credentials');
    }
    const ok = await this.passwords.verify(password, credential.secretHash);
    if (!ok) throw badRequest('Invalid credentials');

    await this.credentialStore.save({ ...credential, lastUsedAt: new Date().toISOString() });
    const session = await this.createSession({
      identity,
      method: 'password',
      ...(device !== undefined ? { device } : {}),
      assurance: 'medium',
    });
    return { identity, session, token: sessionToken(session.id) };
  }

  /** Validate a session token and return the session, or null if invalid/expired/revoked. */
  async validateSessionToken(token: string): Promise<Session | null> {
    const sessionId = tokenToSessionId(token);
    if (sessionId === null) return null;
    const session = await this.sessionStore.get(sessionId);
    if (!session) return null;
    if (session.revokedAt !== undefined) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) return null;
    await this.sessionStore.save({ ...session, lastSeenAt: new Date().toISOString() });
    return session;
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) return false;
    await this.sessionStore.save({ ...session, revokedAt: new Date().toISOString() });
    return true;
  }

  async listSessions(identityId: string): Promise<readonly Session[]> {
    return this.sessionStore.listForIdentity(identityId);
  }

  private async createSession(input: {
    identity: Identity;
    method: string;
    device?: string;
    assurance: AssuranceLevel;
  }): Promise<Session> {
    const now = new Date();
    const session: Session = {
      id: randomId('ses'),
      identityId: input.identity.id,
      principalKind: input.identity.principalKind,
      authenticationMethod: input.method,
      authenticationTime: now.toISOString(),
      assuranceLevel: input.assurance,
      ...(input.device !== undefined ? { device: input.device } : {}),
      expiresAt: new Date(now.getTime() + this.sessionTtlSeconds * 1000).toISOString(),
      lastSeenAt: now.toISOString(),
    };
    return this.sessionStore.create(session);
  }

  private async getIdentity(identityId: string): Promise<Identity> {
    const identity = await this.identityStore.get(identityId);
    if (!identity) throw notFound(`Identity "${identityId}" not found`);
    return identity;
  }
}

/** Opaque session token — no provider-specific claims, just a reference. */
function sessionToken(sessionId: string): string {
  return `ses_${Buffer.from(sessionId).toString('base64url')}`;
}

function tokenToSessionId(token: string): string | null {
  if (!token.startsWith('ses_')) return null;
  try {
    const decoded = Buffer.from(token.slice(4), 'base64url').toString('utf8');
    return decoded.startsWith('ses_') ? decoded : null;
  } catch {
    return null;
  }
}
