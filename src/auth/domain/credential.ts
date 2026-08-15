export type CredentialKind =
  | 'password'
  | 'passkey'
  | 'oauth'
  | 'oidc'
  | 'service-token'
  | 'api-key'
  | 'machine';

export type CredentialStatus = 'active' | 'revoked' | 'expired';

export interface Credential {
  readonly id: string;
  readonly identityId: string;
  readonly kind: CredentialKind;
  readonly status: CredentialStatus;
  readonly secretHash?: string;
  readonly label?: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly revokedAt?: string;
  readonly lastUsedAt?: string;
}

export interface CreatePasswordCredentialInput {
  readonly identityId: string;
  readonly password: string;
  readonly label?: string;
}

export interface PasswordHashing {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}
