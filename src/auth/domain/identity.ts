export type PrincipalKind = 'human' | 'agent' | 'service' | 'application' | 'module' | 'device';

export type IdentityStatus = 'active' | 'disabled' | 'locked' | 'pending' | 'deleted';

export interface ExternalIdentity {
  readonly id: string;
  readonly integrationId: string;
  readonly provider: string;
  readonly providerSubject: string;
  readonly email?: string;
  readonly emailVerified?: boolean;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly linkedAt: string;
}

export interface IdentityMembership {
  readonly id: string;
  readonly organizationId: string;
  readonly roleIds: readonly string[];
  readonly joinedAt: string;
}

export interface Identity {
  readonly id: string;
  readonly principalKind: PrincipalKind;
  readonly status: IdentityStatus;
  readonly profile: {
    readonly displayName?: string;
    readonly primaryEmail?: string;
    readonly pictureUrl?: string;
  };
  readonly credentials: readonly string[]; // credential ids
  readonly externalIdentities: readonly ExternalIdentity[];
  readonly memberships: readonly IdentityMembership[];
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateIdentityInput {
  readonly principalKind?: PrincipalKind;
  readonly displayName?: string;
  readonly primaryEmail?: string;
  readonly pictureUrl?: string;
  readonly roles?: readonly string[];
  readonly permissions?: readonly string[];
}

export interface Principal {
  readonly kind: PrincipalKind;
  readonly identityId: string;
  readonly displayName?: string;
}

export interface AuthenticationContext {
  readonly principal: Principal;
  readonly sessionId?: string;
  readonly authenticationMethod?: string;
  readonly scopes: readonly string[];
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly assurance: number;
  readonly correlation: Readonly<Record<string, string>>;
}
