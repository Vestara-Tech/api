import { conflict, notFound } from '../../core/errors.js';
import type { PermissionContributor, PermissionDefinition, PermissionGrant, PermissionRole } from '../domain/contracts.js';

/**
 * PERM-002/004/014 — Permission registry. Holds permission definitions
 * (contributed per module), roles (aggregate grants), and principal grants.
 */
export class PermissionRegistry {
  private readonly definitions = new Map<string, PermissionDefinition>();
  private readonly roles = new Map<string, PermissionRole>();
  private readonly grants = new Map<string, PermissionGrant[]>();
  private readonly contributors = new Map<string, PermissionContributor>();

  registerDefinition(definition: PermissionDefinition): void {
    if (this.definitions.has(definition.id)) throw conflict(`Permission "${definition.id}" already registered`);
    this.definitions.set(definition.id, definition);
  }

  registerContributor(contributor: PermissionContributor): void {
    if (this.contributors.has(contributor.moduleId)) throw conflict(`Permission contributor "${contributor.moduleId}" already registered`);
    for (const definition of contributor.getPermissionDefinitions()) {
      this.registerDefinition(definition);
    }
    this.contributors.set(contributor.moduleId, contributor);
  }

  registerRole(role: PermissionRole): void {
    if (this.roles.has(role.id)) throw conflict(`Role "${role.id}" already registered`);
    this.roles.set(role.id, role);
  }

  /** Grant a permission to a principal (optionally scoped). */
  grant(grant: PermissionGrant): void {
    const list = this.grants.get(grant.principalId) ?? [];
    if (!list.some((g) => g.permission === grant.permission && g.scope === grant.scope)) {
      list.push(grant);
      this.grants.set(grant.principalId, list);
    }
  }

  /** Grant every permission in a role to a principal. */
  grantRole(principalId: string, roleId: string): void {
    const role = this.getRole(roleId);
    for (const permission of role.permissions) {
      this.grant({ principalId, permission });
    }
  }

  getDefinition(id: string): PermissionDefinition {
    const definition = this.definitions.get(id);
    if (!definition) throw notFound(`Permission "${id}" not found`);
    return definition;
  }

  getRole(id: string): PermissionRole {
    const role = this.roles.get(id);
    if (!role) throw notFound(`Role "${id}" not found`);
    return role;
  }

  listDefinitions(): readonly PermissionDefinition[] {
    return [...this.definitions.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listRoles(): readonly PermissionRole[] {
    return [...this.roles.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listGrants(principalId: string): readonly PermissionGrant[] {
    return this.grants.get(principalId) ?? [];
  }

  hasDefinition(id: string): boolean {
    return this.definitions.has(id);
  }
}
