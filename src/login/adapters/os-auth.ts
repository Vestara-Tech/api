import type { AuthenticationRequest, LoginUser, OsPrincipalMapping } from '../domain/contracts.js';

/**
 * LOGIN-002 — OS principal/account model. An OS account maps to a Vestara
 * identity (single-login) without making Fastify responsible for Linux auth.
 */
export interface OsPrincipal {
  readonly uid: number;
  readonly username: string;
  readonly displayName: string;
  readonly homeDir: string;
  readonly shell: string;
  readonly vestaraIdentityId?: string;
}

/**
 * LOGIN-003 — PAM authentication port. The login broker authenticates through
 * the OS PAM stack (or FIDO2/fingerprint adapters); the UI never validates a
 * password itself.
 */
export interface OsAuthenticationAdapter {
  readonly id: string;
  authenticate(request: AuthenticationRequest): Promise<{ ok: boolean; challengeRequired?: boolean; reason?: string }>;
  listUsers(): Promise<readonly LoginUser[]>;
  getPrincipal(uid: number): Promise<OsPrincipal | null>;
}

/**
 * LOGIN-013 — Display-manager adapter. Leaves room for LightDM, SDDM, GDM, or a
 * future Vestara session manager without coupling the product to one.
 */
export interface DisplayManagerAdapter {
  readonly id: string;
  discover(): Promise<{ readonly available: boolean; readonly name?: string }>;
  listUsers(): Promise<readonly LoginUser[]>;
  startSession(userId: string): Promise<{ ok: boolean; sessionId?: string; reason?: string }>;
  terminateSession(sessionId: string): Promise<void>;
}
