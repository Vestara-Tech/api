export type LoginFailureReason = 'denied' | 'invalid-credentials' | 'locked' | 'rate-limited' | 'unsupported';

export type LoginChallengeKind = 'password' | 'fido2' | 'fingerprint' | 'smartcard' | 'recovery' | 'passkey';

export interface LoginChallenge {
  readonly kind: LoginChallengeKind;
  readonly userId?: string;
  readonly requestId: string;
  readonly message?: string;
}

export type LoginResult =
  | { readonly status: 'authenticated'; readonly sessionId: string }
  | { readonly status: 'challenge-required'; readonly challenge: LoginChallenge }
  | { readonly status: 'denied'; readonly reason: LoginFailureReason };

export interface LoginUser {
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
}

export interface AuthenticationRequest {
  readonly userId: string;
  readonly method: 'password' | 'fido2' | 'fingerprint' | 'smartcard' | 'passkey' | 'recovery';
  readonly secret?: string;
  readonly challengeResponse?: unknown;
}

/** LOGIN-002 — OS principal → Vestara identity mapping (single-login). */
export interface OsPrincipalMapping {
  readonly uid: number;
  readonly username: string;
  readonly vestaraIdentityId: string;
}

export interface SessionStartRequest {
  readonly userId: string;
  readonly sessionType?: 'vestara' | 'fallback';
}

export interface SessionStartResult {
  readonly ok: boolean;
  readonly sessionId?: string;
  readonly reason?: string;
}

/** LOGIN-001 — Login capability discovery. The UI renders only supported methods. */
export interface LoginCapabilities {
  readonly password: boolean;
  readonly fingerprint: boolean;
  readonly fido2: boolean;
  readonly smartCard: boolean;
  readonly passkey: boolean;
  readonly recovery: boolean;
}
