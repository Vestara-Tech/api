import { PermissionRegistry } from '../permission/registry/permission-registry.js';
import { PermissionEngine } from '../permission/engine/permission-engine.js';
import { TemporaryGrantStore } from '../permission/store/temporary-grant-store.js';
import { PermissionService } from '../permission/service/permission-service.js';
import { platformPermissionContributions } from '../permission/contributions/platform-permissions.js';

export interface PermissionPlatformOptions {
  readonly roles?: readonly { id: string; name: string; permissions: readonly string[] }[];
  readonly resolvePrincipalPermissions?: (principalId: string) => readonly string[];
  readonly resolvePrincipalRoles?: (principalId: string) => readonly string[];
}

export interface PermissionPlatform {
  readonly registry: PermissionRegistry;
  readonly engine: PermissionEngine;
  readonly grants: TemporaryGrantStore;
  readonly service: PermissionService;
}

/** PERM — Composition root. Registers platform permission definitions. */
export function buildPermissionPlatform(options: PermissionPlatformOptions = {}): PermissionPlatform {
  const registry = new PermissionRegistry();
  for (const contributor of platformPermissionContributions()) {
    registry.registerContributor(contributor);
  }
  for (const role of options.roles ?? []) registry.registerRole(role);

  const engine = new PermissionEngine({});
  const grants = new TemporaryGrantStore();
  const service = new PermissionService({
    registry,
    engine,
    grants,
    ...(options.resolvePrincipalPermissions ? { resolvePrincipalPermissions: options.resolvePrincipalPermissions } : {}),
    ...(options.resolvePrincipalRoles ? { resolvePrincipalRoles: options.resolvePrincipalRoles } : {}),
  });
  return { registry, engine, grants, service };
}
