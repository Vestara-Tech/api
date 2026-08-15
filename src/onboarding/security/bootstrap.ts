import { randomBytes } from 'node:crypto';
import { forbidden, unauthorized } from '../../core/errors.js';
import { randomId } from '../../core/identifiers.js';

/**
 * ONB-003 — Bootstrap security.
 *
 * Before the first owner exists, normal administrative APIs must not be open.
 * A dedicated bootstrap token gates the restricted onboarding API. Creating
 * the first owner invalidates the token irreversibly: `bootstrap.enabled=false`
 * and the token is destroyed. Ordinary public API calls can never re-enable it.
 */
export interface BootstrapCredentials {
  readonly enabled: boolean;
  readonly token?: string;
  readonly createdAt: string;
}

export class BootstrapSecurity {
  private credentials: BootstrapCredentials | null = null;

  /** Enable bootstrap mode and issue a one-time token. */
  beginBootstrap(): BootstrapCredentials {
    if (this.credentials !== null) {
      throw forbidden('Bootstrap already begun or completed');
    }
    this.credentials = {
      enabled: true,
      token: `boot_${randomBytes(24).toString('base64url')}`,
      createdAt: new Date().toISOString(),
    };
    return this.credentials;
  }

  /** Validate the bootstrap token for restricted onboarding API access. */
  assertBootstrapToken(token: string): void {
    if (!this.credentials?.enabled || this.credentials.token !== token) {
      throw unauthorized('Valid bootstrap token required');
    }
  }

  /**
   * Invalidate bootstrap irreversibly once the first owner is established.
   * Only this call may disable it; it is invoked by the onboarding execution
   * engine, never by an ordinary API route.
   */
  completeBootstrap(): void {
    if (!this.credentials?.enabled) {
      // Already completed — idempotent but never re-enableable.
      return;
    }
    this.credentials = { enabled: false, createdAt: this.credentials.createdAt };
  }

  isEnabled(): boolean {
    return this.credentials?.enabled === true;
  }

  status(): { enabled: boolean; tokenPresent: boolean } {
    return {
      enabled: this.credentials?.enabled === true,
      tokenPresent: this.credentials?.token !== undefined,
    };
  }

  /** Issue a stable onboarding session id (used by ONB-004). */
  newSessionId(): string {
    return randomId('onb');
  }
}
