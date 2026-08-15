import { forbidden } from '../../core/errors.js';
import type { AuthenticationContext } from '../domain/identity.js';
import type { AuthorizationDecision, PolicyRule } from '../domain/authorization.js';

export interface AuthorizationServiceOptions {
  readonly policies?: readonly PolicyRule[];
  readonly superPermissions?: readonly string[];
}

export class AuthorizationService {
  private readonly policies: readonly PolicyRule[];
  private readonly superPermissions: readonly string[];

  constructor(options: AuthorizationServiceOptions = {}) {
    this.policies = options.policies ?? [];
    this.superPermissions = options.superPermissions ?? ['*'];
  }

  /** Core permission check against the identity's granted permissions. */
  authorize(ctx: AuthenticationContext, permission: string, resource?: string): AuthorizationDecision {
    const granted = ctx.permissions;
    const allowedByPermission = granted.includes('*') || granted.includes(permission);
    const policyDecision = this.evaluatePolicies(ctx, permission, resource);

    // Policy rules that deny take precedence; explicit allow policy overrides the
    // default permission grant only if it carries approval requirements.
    if (policyDecision && policyDecision.effect === 'deny') {
      return { allowed: false, permission, reason: `Denied by policy ${policyDecision.name}` };
    }
    if (allowedByPermission) {
      return {
        allowed: true,
        permission,
        ...(policyDecision && policyDecision.requiresApproval ? { requiredApproval: true } : {}),
      };
    }
    if (policyDecision && policyDecision.effect === 'allow') {
      return {
        allowed: true,
        permission,
        ...(policyDecision.requiresApproval ? { requiredApproval: true } : {}),
      };
    }
    return { allowed: false, permission, reason: `Missing permission "${permission}"` };
  }

  /** Enforce: throws FORBIDDEN when not allowed. Returns the decision. */
  requirePermission(ctx: AuthenticationContext, permission: string, resource?: string): AuthorizationDecision {
    const decision = this.authorize(ctx, permission, resource);
    if (!decision.allowed) throw forbidden(decision.reason ?? `Missing permission "${permission}"`);
    return decision;
  }

  private evaluatePolicies(ctx: AuthenticationContext, permission: string, resource?: string): PolicyRule | null {
    for (const policy of this.policies) {
      if (policy.permission !== permission) continue;
      const matched = policy.when === undefined || policy.when(ctx);
      if (matched) return policy;
    }
    return null;
  }
}
