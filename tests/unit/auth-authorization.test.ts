import { describe, expect, it } from 'vitest';
import { AuthorizationService } from '../../src/auth/service/authorization-service.js';
import type { AuthenticationContext } from '../../src/auth/domain/identity.js';

function ctx(permissions: string[], roles: string[] = []): AuthenticationContext {
  return {
    principal: { kind: 'human', identityId: 'idn_1' },
    scopes: [],
    roles,
    permissions,
    assurance: 2,
    correlation: {},
  };
}

describe('AuthorizationService', () => {
  it('allows a granted permission', () => {
    const service = new AuthorizationService();
    const decision = service.authorize(ctx(['products.delete']), 'products.delete');
    expect(decision.allowed).toBe(true);
  });

  it('allows a wildcard permission', () => {
    const service = new AuthorizationService();
    expect(service.authorize(ctx(['*']), 'anything').allowed).toBe(true);
  });

  it('denies a missing permission', () => {
    const service = new AuthorizationService();
    const decision = service.authorize(ctx(['products.read']), 'products.delete');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Missing permission');
  });

  it('enforces via requirePermission (throws FORBIDDEN)', () => {
    const service = new AuthorizationService();
    expect(() => service.requirePermission(ctx([]), 'products.delete')).toThrow(/Missing permission/);
  });

  it('a deny policy overrides a granted permission', () => {
    const service = new AuthorizationService({
      policies: [
        { id: 'p1', name: 'block-delete-draft', permission: 'products.delete', effect: 'deny', when: (c) => c.principal.kind === 'human' },
      ],
    });
    const decision = service.authorize(ctx(['products.delete']), 'products.delete');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Denied by policy');
  });

  it('flags approval-required when an allow policy requests it', () => {
    const service = new AuthorizationService({
      policies: [
        { id: 'p1', name: 'high-risk-delete', permission: 'products.delete', effect: 'allow', requiresApproval: true },
      ],
    });
    const decision = service.authorize(ctx([]), 'products.delete');
    expect(decision.allowed).toBe(true);
    expect(decision.requiredApproval).toBe(true);
  });
});
