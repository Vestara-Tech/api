import type { AuthenticationContext } from '../domain/identity.js';
import type { AuthorizationDecision } from '../domain/authorization.js';
import type { PermissionService } from '../../permission/service/permission-service.js';
import type { PermissionEffect } from '../../permission/domain/contracts.js';

/**
 * PERM-016 — Auth → Permission adapter. Authentication owns identity and
 * sessions; the Permission Module owns authority and policy. This adapter
 * preserves the existing AuthorizationService contract while delegating the
 * decision to the Permission Module.
 */
export function authPermissionAdapter(permission: PermissionService): {
  authorize(ctx: AuthenticationContext, permissionId: string, resource?: string): AuthorizationDecision;
} {
  return {
    authorize(ctx, permissionId, resource) {
      const decision = permission.evaluate({
        permission: permissionId,
        principalId: ctx.principal.identityId,
        ...(resource !== undefined ? { resource } : {}),
      });
      const effect: PermissionEffect = decision.effect;
      switch (effect) {
        case 'allow':
        case 'constrained':
          return { allowed: true, permission: permissionId, reason: decision.reason };
        case 'approval-required':
          return { allowed: true, permission: permissionId, requiredApproval: true, reason: decision.reason };
        default:
          return { allowed: false, permission: permissionId, reason: decision.reason };
      }
    },
  };
}
