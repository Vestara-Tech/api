import { randomId } from '../../core/identifiers.js';
import type { LoginUser, LoginResult, AuthenticationRequest, LoginCapabilities, SessionStartResult, OsPrincipalMapping } from '../domain/contracts.js';
import type { OsAuthenticationAdapter, DisplayManagerAdapter } from '../adapters/os-auth.js';

export interface LoginBrokerOptions {
  readonly osAuth: OsAuthenticationAdapter;
  readonly displayManager: DisplayManagerAdapter;
  readonly identityMapper: OsIdentityMapper;
}

/** LOGIN-007 — Maps an OS principal to a Vestara identity (single-login). */
export interface OsIdentityMapper {
  map(uid: number, username: string): Promise<OsPrincipalMapping | null>;
  link(osPrincipalId: string, vestaraIdentityId: string): Promise<void>;
}

/**
 * LOGIN-005 — Login broker. UI presents, the broker authenticates through the
 * OS adapter. The UI never validates credentials; no password logging,
 * telemetry, persistence, or evidence payloads.
 */
export class LoginBroker {
  private readonly osAuth: OsAuthenticationAdapter;
  private readonly displayManager: DisplayManagerAdapter;
  private readonly identityMapper: OsIdentityMapper;

  constructor(options: LoginBrokerOptions) {
    this.osAuth = options.osAuth;
    this.displayManager = options.displayManager;
    this.identityMapper = options.identityMapper;
  }

  async capabilities(): Promise<LoginCapabilities> {
    const discover = await this.osAuth;
    void discover;
    return {
      password: true,
      fingerprint: false,
      fido2: false,
      smartCard: false,
      passkey: false,
      recovery: true,
    };
  }

  async listUsers(): Promise<readonly LoginUser[]> {
    return this.osAuth.listUsers();
  }

  /**
   * Authenticate an OS login. Returns a LoginResult; on success, starts the OS
   * session through the display manager and maps the principal to Vestara.
   */
  async authenticate(request: AuthenticationRequest): Promise<LoginResult> {
    const result = await this.osAuth.authenticate(request);
    if (!result.ok) {
      return result.challengeRequired
        ? { status: 'challenge-required', challenge: { kind: 'fido2', requestId: randomId('req'), userId: request.userId } }
        : { status: 'denied', reason: 'invalid-credentials' };
    }

    const sessionStarted = await this.displayManager.startSession(request.userId);
    if (!sessionStarted.ok) {
      return { status: 'denied', reason: 'unsupported' };
    }

    // Map OS principal → Vestara identity (single-login linkage).
    const principal = await this.osAuth.getPrincipal(Number(request.userId));
    if (principal && !principal.vestaraIdentityId) {
      // Link would normally create/resolve the Vestara identity here.
      const mapping = await this.identityMapper.map(principal.uid, principal.username);
      if (mapping) await this.identityMapper.link(principal.username, mapping.vestaraIdentityId);
    }

    return { status: 'authenticated', sessionId: sessionStarted.sessionId ?? randomId('os-session') };
  }

  async lock(): Promise<void> {
    await this.displayManager.terminateSession('current');
  }
}
