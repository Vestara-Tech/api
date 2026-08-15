import { LoginBroker } from '../login/service/login-broker.js';
import { OsSessionManager } from '../login/service/session-manager.js';
import { LoginRateLimit } from '../login/service/rate-limit.js';
import type { OsAuthenticationAdapter, DisplayManagerAdapter, OsPrincipal } from '../login/adapters/os-auth.js';
import type { LoginUser, AuthenticationRequest } from '../login/domain/contracts.js';

/** Dev adapter: reports a fixed user, no privileged PAM access. */
class DevOsAuthAdapter implements OsAuthenticationAdapter {
  readonly id = 'dev-pam';
  private readonly users: LoginUser[] = [{ userId: '1000', displayName: 'Eddie Villanueva' }];
  private readonly principals: Map<number, OsPrincipal> = new Map([
    [1000, { uid: 1000, username: 'eddie', displayName: 'Eddie Villanueva', homeDir: '/home/eddie', shell: '/bin/bash' }],
  ]);

  async authenticate(request: AuthenticationRequest): Promise<{ ok: boolean; reason?: string }> {
    // Dev only: any non-empty password accepted. Never do this in production.
    return { ok: Boolean(request.secret && request.secret.length > 0) };
  }
  async listUsers() {
    return this.users;
  }
  async getPrincipal(uid: number) {
    return this.principals.get(uid) ?? null;
  }
}

class DevDisplayManagerAdapter implements DisplayManagerAdapter {
  readonly id = 'dev-dm';
  async discover() {
    return { available: true, name: 'vestara-greeter' };
  }
  async listUsers() {
    return [{ userId: '1000', displayName: 'Eddie Villanueva' }];
  }
  async startSession() {
    return { ok: true, sessionId: 'os-session-dev' };
  }
  async terminateSession() {}
}

class DevIdentityMapper {
  async map(uid: number, username: string) {
    return { uid, username, vestaraIdentityId: `idn_${uid}` };
  }
  async link(_osPrincipalId: string, _vestaraIdentityId: string) {}
}

export interface LoginBootstrapResult {
  readonly broker: LoginBroker;
  readonly sessions: OsSessionManager;
  readonly rateLimit: LoginRateLimit;
}

export function buildLoginPlatform(): LoginBootstrapResult {
  const broker = new LoginBroker({
    osAuth: new DevOsAuthAdapter(),
    displayManager: new DevDisplayManagerAdapter(),
    identityMapper: new DevIdentityMapper(),
  });
  const sessions = new OsSessionManager();
  const rateLimit = new LoginRateLimit();
  return { broker, sessions, rateLimit };
}
