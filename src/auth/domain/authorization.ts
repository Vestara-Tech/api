import type { AuthenticationContext } from './identity.js';

export interface PermissionCheck {
  readonly principal: { identityId: string; kind: string };
  readonly permission: string;
  readonly resource?: string;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly permission: string;
  readonly reason?: string;
  readonly requiredApproval?: boolean;
}

export interface PolicyRule {
  readonly id: string;
  readonly name: string;
  readonly permission: string;
  readonly effect: 'allow' | 'deny';
  readonly when?: (ctx: AuthenticationContext) => boolean;
  readonly requiresApproval?: boolean;
}

export interface PolicyEngine {
  evaluate(ctx: AuthenticationContext, permission: string, resource?: string): AuthorizationDecision;
}
