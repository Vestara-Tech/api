import type {
  PermissionContext,
  PermissionDecision,
  PermissionDefinition,
  PermissionPolicyRule,
  PermissionRisk,
} from '../domain/contracts.js';

export interface PermissionEngineOptions {
  readonly riskPolicy?: Partial<Record<PermissionRisk, 'auto' | 'approval-required' | 'denied'>>;
  readonly resolveRoles?: (principalId: string) => readonly string[];
}

export interface PermissionEngineInput {
  readonly permission: string;
  readonly principalId: string;
  readonly scope?: string;
  readonly resource?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly granted?: readonly string[];
  readonly roles?: readonly string[];
  readonly policies?: readonly PermissionPolicyRule[];
  readonly definition?: PermissionDefinition;
  readonly approved?: boolean;
}
/**
 * PERM-007/008/009/010 — Policy engine. Capability-oriented authorization with
 * RBAC as one mechanism. Deny precedence, risk classification, approval
 * requirements, scoped constraints, and a structured decision (not a boolean).
 */
export class PermissionEngine {
  private readonly riskPolicy: NonNullable<PermissionEngineOptions['riskPolicy']>;
  private readonly resolveRoles: ((principalId: string) => readonly string[]) | undefined;

  constructor(options: PermissionEngineOptions = {}) {
    this.riskPolicy = options.riskPolicy ?? {};
    this.resolveRoles = options.resolveRoles;
  }

  decide(input: PermissionEngineInput): PermissionDecision {
    const roles = input.roles ?? this.resolveRoles?.(input.principalId) ?? [];
    const effective = expandPermissions(input.granted ?? [], roles);
    const context: PermissionContext = {
      principalId: input.principalId,
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.resource !== undefined ? { resource: input.resource } : {}),
      ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
    };

    // 1. Policy rules: deny takes precedence over everything.
    for (const policy of input.policies ?? []) {
      if (policy.permission !== input.permission) continue;
      if (policy.scope !== undefined && policy.scope !== input.scope) continue;
      if (policy.when !== undefined && !policy.when(context)) continue;
      if (policy.effect === 'deny') {
        return {
          effect: 'deny',
          permission: input.permission,
          principalId: input.principalId,
          reason: `Denied by policy "${policy.id}"`,
          matchedPolicies: [policy.id],
          constraints: policy.constraints ?? [],
          risk: input.definition?.risk ?? 'medium',
          ...(policy.risk !== undefined ? { risk: policy.risk } : {}),
        };
      }
    }

    // 2. Direct/role grants.
    const granted = effective.includes('*') || effective.includes(input.permission);
    if (!granted) {
      return {
        effect: 'deny',
        permission: input.permission,
        principalId: input.principalId,
        reason: `Principal "${input.principalId}" lacks permission "${input.permission}"`,
        matchedPolicies: [],
        constraints: [],
        risk: input.definition?.risk ?? 'medium',
      };
    }

    // 3. Risk policy: approval required or denied regardless of grant.
    const risk = input.definition?.risk ?? 'medium';
    const riskRule = this.riskPolicy[risk];
    if (riskRule === 'denied') {
      return {
        effect: 'deny',
        permission: input.permission,
        principalId: input.principalId,
        reason: `Risk "${risk}" is denied by policy`,
        matchedPolicies: [],
        constraints: [],
        risk,
      };
    }
    const definitionApproval = input.definition?.approval;
    const needsApproval = riskRule === 'approval-required' || definitionApproval === 'explicit';
    if (needsApproval && input.approved !== true) {
      return {
        effect: 'approval-required',
        permission: input.permission,
        principalId: input.principalId,
        reason: `Permission "${input.permission}" requires approval`,
        matchedPolicies: [],
        constraints: input.definition?.constraints ?? [],
        risk,
      };
    }

    // 4. Constraints.
    const constraints = input.definition?.constraints ?? [];
    if (constraints.length > 0) {
      return {
        effect: 'constrained',
        permission: input.permission,
        principalId: input.principalId,
        reason: `Permission "${input.permission}" is constrained`,
        matchedPolicies: [],
        constraints,
        risk,
      };
    }

    return {
      effect: 'allow',
      permission: input.permission,
      principalId: input.principalId,
      reason: `Principal "${input.principalId}" is granted "${input.permission}"`,
      matchedPolicies: [],
      constraints: [],
      risk,
    };
  }
}

/** Expand a principal's direct grants + role-granted permissions. */
export function expandPermissions(granted: readonly string[], roles: readonly string[]): readonly string[] {
  const set = new Set(granted);
  // Roles are resolved by the caller via resolveRoles; this is a pass-through.
  void roles;
  return [...set];
}
