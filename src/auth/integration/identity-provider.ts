import type { ExternalIdentity } from '../domain/identity.js';

export interface AuthorizationRequest {
  readonly integrationId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly codeChallenge?: string;
  readonly scope?: readonly string[];
}

export interface AuthorizationRedirect {
  readonly url: string;
  readonly state: string;
}

export interface AuthorizationCodeExchange {
  readonly integrationId: string;
  readonly code: string;
  readonly redirectUri: string;
  readonly codeVerifier?: string;
}

export interface RefreshIdentityRequest {
  readonly integrationId: string;
  readonly refreshToken: string;
}

export interface RevokeIdentityRequest {
  readonly integrationId: string;
  readonly token: string;
}

/**
 * External identity provider contract (AUTH-006). Adapters implement this for
 * Google/GitHub/Facebook/etc. The Authentication module never imports provider
 * SDKs; it consumes these ports through the integration module.
 *
 * The adapter is responsible for protocol/provider verification (code + PKCE
 * exchange, token validation) and returns a normalized `ExternalIdentity`.
 */
export interface ExternalIdentityProvider {
  readonly integrationId: string;

  getAuthorizationRequest(input: AuthorizationRequest): Promise<AuthorizationRedirect>;

  exchangeAuthorizationCode(input: AuthorizationCodeExchange): Promise<ExternalIdentity>;

  refreshIdentity?(input: RefreshIdentityRequest): Promise<ExternalIdentity>;

  revoke?(input: RevokeIdentityRequest): Promise<void>;
}
