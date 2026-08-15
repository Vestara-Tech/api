/** PERM — Permission Module domain contracts. */

export type PermissionRisk = 'low' | 'medium' | 'high' | 'critical';

export type ApprovalRequirement =
  | 'none'
  | 'auto'
  | 'explicit'
  | { readonly approver: 'human' | 'system' | 'policy'; readonly timeoutSeconds?: number };

export interface PermissionConstraint {
  readonly type: string;
  readonly value: unknown;
}

export interface PermissionDefinition {
  readonly id: string;
  readonly resource: string;
  readonly action: string;
  readonly risk: PermissionRisk;
  readonly description?: string;
  readonly approval?: ApprovalRequirement;
  readonly constraints?: readonly PermissionConstraint[];
}

export type PermissionEffect = 'allow' | 'deny' | 'approval-required' | 'constrained';

export interface PermissionDecision {
  readonly effect: PermissionEffect;
  readonly permission: string;
  readonly principalId: string;
  readonly reason: string;
  readonly matchedPolicies: readonly string[];
  readonly constraints: readonly PermissionConstraint[];
  readonly risk: PermissionRisk;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

export interface PermissionGrant {
  readonly principalId: string;
  readonly permission: string;
  readonly scope?: string;
  readonly constraints?: readonly PermissionConstraint[];
}

export interface PermissionRole {
  readonly id: string;
  readonly name: string;
  readonly permissions: readonly string[];
  readonly description?: string;
}

export interface PermissionPolicyRule {
  readonly id: string;
  readonly permission: string;
  readonly effect: 'allow' | 'deny';
  readonly scope?: string;
  readonly constraints?: readonly PermissionConstraint[];
  readonly risk?: PermissionRisk;
  readonly approval?: ApprovalRequirement;
  readonly when?: (ctx: PermissionContext) => boolean;
}

export interface PermissionContext {
  readonly principalId: string;
  readonly scope?: string;
  readonly resource?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

/** PERM-011 — temporary grant / lease. */
export interface TemporaryPermissionGrant {
  readonly id: string;
  readonly principalId: string;
  readonly permission: string;
  readonly scope?: string;
  readonly reason: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly maxUses?: number;
  readonly uses: number;
  readonly approvedBy?: string;
}

/** PERM-014 — module permission contributions. */
export interface PermissionContributor {
  readonly moduleId: string;
  getPermissionDefinitions(): readonly PermissionDefinition[];
}
