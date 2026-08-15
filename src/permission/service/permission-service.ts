import type {
  PermissionContext,
  PermissionDecision,
  PermissionPolicyRule,
  TemporaryPermissionGrant,
} from '../domain/contracts.js';
import { PermissionRegistry } from '../registry/permission-registry.js';
import { PermissionEngine } from '../engine/permission-engine.js';
import { TemporaryGrantStore, type CreateTemporaryGrantInput } from '../store/temporary-grant-store.js';

export interface PermissionServiceOptions {
  readonly registry: PermissionRegistry;
  readonly engine: PermissionEngine;
  readonly grants: TemporaryGrantStore;
  readonly policies?: readonly PermissionPolicyRule[];
  readonly resolvePrincipalPermissions?: (principalId: string) => readonly string[];
  readonly resolvePrincipalRoles?: (principalId: string) => readonly string[];
}

export interface EvaluatePermissionInput {
  readonly permission: string;
  readonly principalId: string;
  readonly scope?: string;
  readonly resource?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly approved?: boolean;
  readonly temporaryGrantId?: string;
}

export interface PermissionService {
  evaluate(input: EvaluatePermissionInput): PermissionDecision;
  effectivePermissions(principalId: string, scope?: string): readonly string[];
  grant(principalId: string, permission: string, scope?: string): void;
  grantRole(principalId: string, roleId: string): void;
  delegate(delegatorId: string, delegateeId: string, permissions: readonly string[], scope?: string): readonly string[];
  issueTemporaryGrant(input: CreateTemporaryGrantInput): unknown;
}

/**
 * PERM-013 — Permission service. Effective-permission resolver + evaluation
 * facade over the registry, engine and lease store. Delegation is bounded:
 * delegated permissions ⊆ delegator effective permissions.
 */
export class PermissionService implements PermissionService {
  private readonly registry: PermissionRegistry;
  private readonly engine: PermissionEngine;
  private readonly grants: TemporaryGrantStore;
  private readonly policies: readonly PermissionPolicyRule[];
  private readonly resolvePrincipalPermissions: (principalId: string) => readonly string[];
  private readonly resolvePrincipalRoles: (principalId: string) => readonly string[];

  constructor(options: PermissionServiceOptions) {
    this.registry = options.registry;
    this.engine = options.engine;
    this.grants = options.grants;
    this.policies = options.policies ?? [];
    this.resolvePrincipalPermissions = options.resolvePrincipalPermissions ?? (() => []);
    this.resolvePrincipalRoles = options.resolvePrincipalRoles ?? (() => []);
  }

  evaluate(input: EvaluatePermissionInput): PermissionDecision {
    const granted = this.resolvePrincipalPermissions(input.principalId);
    const roles = this.resolvePrincipalRoles(input.principalId);
    const registryGrants = this.registry.listGrants(input.principalId).map((g) => g.permission);
    const rolePerms = rolePermissions(this.registry, roles);
    const grantedWithRoles = [...new Set([...granted, ...registryGrants, ...rolePerms])];
    let definition;
    try {
      definition = this.registry.getDefinition(input.permission);
    } catch {
      definition = undefined;
    }

    // A valid temporary grant satisfies the permission gate.
    if (input.temporaryGrantId !== undefined && this.grants.isValid(input.temporaryGrantId, input.principalId, input.permission)) {
      return {
        effect: 'allow',
        permission: input.permission,
        principalId: input.principalId,
        reason: `Allowed by temporary grant "${input.temporaryGrantId}"`,
        matchedPolicies: [],
        constraints: [],
        risk: definition?.risk ?? 'medium',
        evidence: { temporaryGrantId: input.temporaryGrantId },
      };
    }

    return this.engine.decide({
      permission: input.permission,
      principalId: input.principalId,
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.resource !== undefined ? { resource: input.resource } : {}),
      ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
      ...(input.approved !== undefined ? { approved: input.approved } : {}),
      granted: grantedWithRoles,
      roles,
      policies: this.policies,
      ...(definition !== undefined ? { definition } : {}),
    });
  }

  effectivePermissions(principalId: string, scope?: string): readonly string[] {
    const granted = this.resolvePrincipalPermissions(principalId);
    const roles = this.resolvePrincipalRoles(principalId);
    const registryGrants = this.registry.listGrants(principalId).map((g) => g.permission);
    const all = new Set([...granted, ...registryGrants, ...rolePermissions(this.registry, roles)]);
    const result: string[] = [];
    for (const permission of all) {
      const decision = this.evaluate({ permission, principalId, ...(scope !== undefined ? { scope } : {}) });
      if (decision.effect === 'allow' || decision.effect === 'constrained' || decision.effect === 'approval-required') {
        result.push(permission);
      }
    }
    return result.sort();
  }

  grant(principalId: string, permission: string, scope?: string): void {
    this.registry.grant({ principalId, permission, ...(scope !== undefined ? { scope } : {}) });
  }

  grantRole(principalId: string, roleId: string): void {
    this.registry.grantRole(principalId, roleId);
  }

  delegate(delegatorId: string, delegateeId: string, permissions: readonly string[], scope?: string): readonly string[] {
    const delegatorEffective = new Set(this.effectivePermissions(delegatorId, scope));
    const delegated = permissions.filter((p) => delegatorEffective.has(p));
    for (const permission of delegated) {
      this.grant(delegateeId, permission, scope);
    }
    return delegated;
  }

  issueTemporaryGrant(input: CreateTemporaryGrantInput): TemporaryPermissionGrant {
    return this.grants.issue(input);
  }
}

function rolePermissions(registry: PermissionRegistry, roles: readonly string[]): readonly string[] {
  const out = new Set<string>();
  for (const roleId of roles) {
    try {
      for (const permission of registry.getRole(roleId).permissions) out.add(permission);
    } catch {
      // Unknown roles are ignored.
    }
  }
  return [...out];
}
