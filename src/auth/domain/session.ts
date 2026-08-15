export type AssuranceLevel = 'none' | 'low' | 'medium' | 'high';

export interface Session {
  readonly id: string;
  readonly identityId: string;
  readonly principalKind: string;
  readonly authenticationMethod: string;
  readonly authenticationTime: string;
  readonly assuranceLevel: AssuranceLevel;
  readonly device?: string;
  readonly expiresAt: string;
  readonly lastSeenAt: string;
  readonly revokedAt?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CreateSessionInput {
  readonly identityId: string;
  readonly principalKind: string;
  readonly authenticationMethod: string;
  readonly assuranceLevel: AssuranceLevel;
  readonly device?: string;
  readonly ttlSeconds?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
