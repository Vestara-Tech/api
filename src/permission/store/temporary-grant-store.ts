import { randomId } from '../../core/identifiers.js';
import type { TemporaryPermissionGrant } from '../domain/contracts.js';

export interface CreateTemporaryGrantInput {
  readonly principalId: string;
  readonly permission: string;
  readonly scope?: string;
  readonly reason: string;
  readonly durationSeconds: number;
  readonly maxUses?: number;
  readonly approvedBy?: string;
}

/**
 * PERM-011 — Temporary grants / leases. Agents get bounded, expiring capability
 * tokens rather than permanent escalation. Delegated authority never exceeds
 * the delegator's effective permissions.
 */
export class TemporaryGrantStore {
  private readonly grants = new Map<string, TemporaryPermissionGrant>();

  issue(input: CreateTemporaryGrantInput): TemporaryPermissionGrant {
    const grant: TemporaryPermissionGrant = {
      id: randomId('tmp'),
      principalId: input.principalId,
      permission: input.permission,
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      reason: input.reason,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + input.durationSeconds * 1000).toISOString(),
      uses: 0,
      ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
      ...(input.approvedBy !== undefined ? { approvedBy: input.approvedBy } : {}),
    };
    this.grants.set(grant.id, grant);
    return grant;
  }

  isValid(id: string, principalId: string, permission: string): boolean {
    const grant = this.grants.get(id);
    if (!grant) return false;
    if (grant.principalId !== principalId || grant.permission !== permission) return false;
    if (new Date(grant.expiresAt) < new Date()) return false;
    if (grant.maxUses !== undefined && grant.uses >= grant.maxUses) return false;
    return true;
  }

  consume(id: string): TemporaryPermissionGrant | undefined {
    const grant = this.grants.get(id);
    if (!grant) return undefined;
    if (!this.isValid(id, grant.principalId, grant.permission)) return undefined;
    const updated: TemporaryPermissionGrant = { ...grant, uses: grant.uses + 1 };
    this.grants.set(id, updated);
    return updated;
  }

  revoke(id: string): boolean {
    return this.grants.delete(id);
  }

  list(principalId?: string): readonly TemporaryPermissionGrant[] {
    const all = [...this.grants.values()].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
    return principalId !== undefined ? all.filter((g) => g.principalId === principalId) : all;
  }
}
