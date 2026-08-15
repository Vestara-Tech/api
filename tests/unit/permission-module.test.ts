import { describe, expect, it } from 'vitest';
import {
  PermissionRegistry,
  PermissionEngine,
  PermissionService,
  TemporaryGrantStore,
  platformPermissionContributions,
  type PermissionPolicyRule,
} from '../../src/permission/index.js';

function build(options: { granted?: readonly string[]; roles?: readonly string[] } = {}) {
  const registry = new PermissionRegistry();
  for (const contributor of platformPermissionContributions()) registry.registerContributor(contributor);
  const engine = new PermissionEngine({});
  const grants = new TemporaryGrantStore();
  const service = new PermissionService({
    registry,
    engine,
    grants,
    resolvePrincipalPermissions: () => options.granted ?? [],
    resolvePrincipalRoles: () => options.roles ?? [],
  });
  return { registry, engine, service, grants };
}

describe('PERM-014 module contributions', () => {
  it('registers file/agent/workflow/generator/system/integration permissions', () => {
    const { registry } = build();
    const ids = registry.listDefinitions().map((d) => d.id);
    for (const expected of ['file.write', 'file.delete', 'file.system.write', 'agent.delegate', 'workflow.publish', 'generator.apply', 'system.firmware.logo.apply', 'integration.write']) {
      expect(ids).toContain(expected);
    }
    expect(registry.getDefinition('file.system.write').risk).toBe('critical');
    expect(registry.getDefinition('generator.apply').approval).toBe('explicit');
  });
});

describe('PERM-007/008 deny precedence', () => {
  it('denies when a policy denies even if the principal has the grant', () => {
    const { service } = build({ granted: ['file.write'] });
    const policies: PermissionPolicyRule[] = [
      { id: 'no-secrets', permission: 'file.write', effect: 'deny', scope: 'secrets/**' },
    ];
    const withPolicy = new PermissionService({
      registry: build().registry,
      engine: new PermissionEngine({}),
      grants: new TemporaryGrantStore(),
      policies,
      resolvePrincipalPermissions: () => ['file.write'],
    });
    const decision = withPolicy.evaluate({ permission: 'file.write', principalId: 'dev-1', scope: 'secrets/**' });
    expect(decision.effect).toBe('deny');
    expect(decision.matchedPolicies).toContain('no-secrets');
  });

  it('allows when granted with no denying policy', () => {
    const { service } = build({ granted: ['file.read'] });
    const decision = service.evaluate({ permission: 'file.read', principalId: 'dev-1' });
    expect(decision.effect).toBe('allow');
    expect(decision.risk).toBe('low');
  });

  it('denies when the principal lacks the permission', () => {
    const { service } = build({ granted: [] });
    const decision = service.evaluate({ permission: 'file.write', principalId: 'anon' });
    expect(decision.effect).toBe('deny');
    expect(decision.reason).toContain('lacks permission');
  });
});

describe('PERM-009/010 risk + approval', () => {
  it('requires approval for explicit-approval permissions', () => {
    const { service } = build({ granted: ['file.system.write'] });
    const decision = service.evaluate({ permission: 'file.system.write', principalId: 'dev-1' });
    expect(decision.effect).toBe('approval-required');

    const approved = service.evaluate({ permission: 'file.system.write', principalId: 'dev-1', approved: true });
    expect(approved.effect).toBe('allow');
  });

  it('marks constrained permissions as constrained', () => {
    const registry = new PermissionRegistry();
    for (const contributor of platformPermissionContributions()) registry.registerContributor(contributor);
    registry.registerDefinition({
      id: 'file.write.scoped',
      resource: 'file',
      action: 'write.scoped',
      risk: 'medium',
      constraints: [{ type: 'maxFileSize', value: 1024 * 1024 }],
    });
    const engine = new PermissionEngine({});
    const service = new PermissionService({
      registry,
      engine,
      grants: new TemporaryGrantStore(),
      resolvePrincipalPermissions: () => ['file.write.scoped'],
    });
    const decision = service.evaluate({ permission: 'file.write.scoped', principalId: 'dev-1' });
    expect(decision.effect).toBe('constrained');
    expect(decision.constraints[0]!.type).toBe('maxFileSize');
  });
});

describe('PERM-013 effective permissions + delegation', () => {
  it('resolves effective permissions from grants and roles', () => {
    const registry = new PermissionRegistry();
    for (const contributor of platformPermissionContributions()) registry.registerContributor(contributor);
    registry.registerRole({ id: 'dev', name: 'Developer', permissions: ['file.read', 'file.write', 'agent.run'] });
    const engine = new PermissionEngine({});
    const service = new PermissionService({
      registry,
      engine,
      grants: new TemporaryGrantStore(),
      resolvePrincipalPermissions: () => ['workflow.execute'],
      resolvePrincipalRoles: () => ['dev'],
    });
    const effective = service.effectivePermissions('dev-1');
    expect(effective).toContain('file.read');
    expect(effective).toContain('file.write');
    expect(effective).toContain('workflow.execute');
  });

  it('delegation never exceeds the delegator effective permissions', () => {
    const { service } = build({ granted: ['file.read', 'file.write'] });
    const delegated = service.delegate('dev-1', 'verifier-1', ['file.read', 'file.write', 'file.delete']);
    expect(delegated).toContain('file.read');
    expect(delegated).toContain('file.write');
    expect(delegated).not.toContain('file.delete');
  });
});

describe('PERM-011 temporary grants', () => {
  it('issues, validates, and consumes a lease', () => {
    const { service, grants } = build({ granted: [] });
    const grant = service.issueTemporaryGrant({
      principalId: 'dev-1',
      permission: 'database.schema.modify',
      scope: 'database://development',
      reason: 'Migration workflow #382',
      durationSeconds: 600,
      maxUses: 2,
      approvedBy: 'user-1',
    });
    expect(grants.isValid(grant.id, 'dev-1', 'database.schema.modify')).toBe(true);

    // The temporary grant satisfies the permission gate even without a grant.
    const decision = service.evaluate({ permission: 'database.schema.modify', principalId: 'dev-1', temporaryGrantId: grant.id });
    expect(decision.effect).toBe('allow');
    expect(decision.evidence?.temporaryGrantId).toBe(grant.id);

    grants.consume(grant.id);
    grants.consume(grant.id);
    expect(grants.isValid(grant.id, 'dev-1', 'database.schema.modify')).toBe(false);
  });

  it('does not grant a temporary lease to the wrong principal', () => {
    const { service, grants } = build({ granted: [] });
    const grant = service.issueTemporaryGrant({ principalId: 'dev-1', permission: 'x.run', reason: 'r', durationSeconds: 60 });
    expect(grants.isValid(grant.id, 'other', 'x.run')).toBe(false);
  });
});
