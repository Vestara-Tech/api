import { describe, expect, it } from 'vitest';
import {
  UserService,
  UserResolver,
  UserProvisioner,
  canTransition,
  isHumanIdentity,
  USER_CAPABILITIES,
  hasUserCapability,
  type User,
} from '../../src/user/index.js';

function createUser(service: UserService, overrides: Partial<User> = {}): User {
  return service.create({
    identityId: overrides.identityId ?? 'ident_1',
    username: overrides.username ?? 'eddie',
    profile: { displayName: 'Eddie Villanueva', jobTitle: 'Developer', organization: 'Vestara-Tech' },
    preferences: { 'ui.theme': 'dark', 'ai.defaultModel': 'deepseek' },
    settings: { emailVerified: true, email: 'eddie@vestara.dev' },
  });
}

describe('USR-001/002 user domain', () => {
  it('links a user to an identity without absorbing credentials', () => {
    const service = new UserService();
    const user = createUser(service);
    expect(user.identityId).toBe('ident_1');
    expect(user.id.startsWith('user_')).toBe(true);
    // Credentials/auth are deliberately absent from the User model.
    expect('credentials' in user).toBe(false);
    expect('password' in user).toBe(false);
  });

  it('classifies machine identities as non-human', () => {
    expect(isHumanIdentity('human')).toBe(true);
    expect(isHumanIdentity('agent')).toBe(false);
    expect(isHumanIdentity('service')).toBe(false);
    expect(isHumanIdentity('application')).toBe(false);
  });
});

describe('USR-003 lifecycle', () => {
  it('transitions invited -> pending -> active -> suspended -> active', () => {
    const service = new UserService();
    const user = service.create({ identityId: 'i1', username: 'u1', status: 'invited', profile: { displayName: 'U' } });
    expect(canTransition('invited', 'pending')).toBe(true);
    expect(service.transition(user.id, 'pending').status).toBe('pending');
    expect(service.transition(user.id, 'active').status).toBe('active');
    expect(service.transition(user.id, 'suspended').status).toBe('suspended');
    expect(service.transition(user.id, 'active').status).toBe('active');
  });

  it('soft-deletes via tombstoning (deletedAt set, row retained)', () => {
    const service = new UserService();
    const user = createUser(service, { identityId: 'i2', username: 'u2' });
    service.transition(user.id, 'active');
    service.transition(user.id, 'deleting');
    const deleted = service.transition(user.id, 'deleted');
    expect(deleted.status).toBe('deleted');
    expect(deleted.deletedAt).toBeTruthy();
  });

  it('rejects invalid transitions', () => {
    const service = new UserService();
    const user = createUser(service);
    expect(() => service.transition(user.id, 'deleting')).toThrow(/Cannot transition/);
    expect(canTransition('pending', 'active')).toBe(true);
    expect(canTransition('pending', 'deleting')).toBe(false);
  });
});

describe('USR-004/005 profile + preferences', () => {
  it('updates profile and namespaced preferences', () => {
    const service = new UserService();
    const user = createUser(service);
    const updated = service.updateProfile(user.id, { displayName: 'Eddie V.', organization: 'Vestara' });
    expect(updated.profile.displayName).toBe('Eddie V.');

    const prefs = service.updatePreferences(user.id, { 'ui.theme': 'light', 'notifications.enabled': false });
    expect(prefs.preferences['ui.theme']).toBe('light');
    expect(prefs.preferences['ai.defaultModel']).toBe('deepseek'); // merged, not replaced
  });
});

describe('USR-006/007 store + service', () => {
  it('deduplicates users by username and identity', () => {
    const service = new UserService();
    createUser(service);
    expect(() => createUser(service)).toThrow(/already exists/);
    expect(() => createUser(service, { identityId: 'ident_2' })).toThrow(/already exists/);
    expect(service.list()).toHaveLength(1);
  });

  it('resolves users by id, identity and username', () => {
    const service = new UserService();
    const user = createUser(service);
    expect(service.get(user.id).username).toBe('eddie');
    expect(service.getByIdentity('ident_1')!.id).toBe(user.id);
    expect(service.getByUsername('eddie')!.id).toBe(user.id);
  });

  it('manages memberships', () => {
    const service = new UserService();
    const user = createUser(service);
    const withMembership = service.addMembership(user.id, { id: 'm1', organizationId: 'org-vestara', roleIds: ['developer'] });
    expect(withMembership.memberships).toHaveLength(1);
    expect(() => service.addMembership(user.id, { id: 'm1', organizationId: 'org', roleIds: [] })).toThrow(/already exists/);
    const removed = service.removeMembership(user.id, 'm1');
    expect(removed.memberships).toHaveLength(0);
  });
});

describe('USR-009 capabilities', () => {
  it('distinguishes safe self-service from governed lifecycle ops', () => {
    expect(hasUserCapability('user.read')).toBe(true);
    expect(hasUserCapability('user.self.preferences')).toBe(true);
    const deleteCap = USER_CAPABILITIES.find((c) => c.id === 'user.delete')!;
    expect(deleteCap.requiresApproval).toBe(true);
    expect(deleteCap.risk).toBe('high');
    const selfCap = USER_CAPABILITIES.find((c) => c.id === 'user.self.profile')!;
    expect(selfCap.requiresApproval).toBe(false);
  });
});

describe('USR-010/012 auth + onboarding integration', () => {
  it('resolves a human identity to a user context', () => {
    const service = new UserService();
    const user = createUser(service);
    const resolver = new UserResolver({ getByIdentity: (id) => service.getByIdentity(id) });
    const context = resolver.resolve('ident_1', 'human');
    expect(context?.userId).toBe(user.id);
    expect(context?.username).toBe('eddie');
    expect(context?.principalKind).toBe('human');
  });

  it('does not resolve machine identities to users', () => {
    const service = new UserService();
    createUser(service);
    const resolver = new UserResolver({ getByIdentity: (id) => service.getByIdentity(id) });
    const agentContext = resolver.resolve('ident_1', 'agent');
    expect(agentContext?.userId).toBeUndefined();
    expect(agentContext?.principalKind).toBe('agent');
  });

  it('provisions a user on first login and triggers onboarding', async () => {
    const service = new UserService();
    let onboarded = 0;
    const provisioner = new UserProvisioner(
      { getByIdentity: (id) => service.getByIdentity(id), create: (input) => service.create({ ...input, identityId: input.identityId }) },
      { complete: async () => { onboarded += 1; } },
    );
    const first = await provisioner.ensureUser('ident_new', 'New Person');
    expect(first.created).toBe(true);
    expect(onboarded).toBe(1);
    const second = await provisioner.ensureUser('ident_new', 'New Person');
    expect(second.created).toBe(false);
    expect(onboarded).toBe(1);
  });
});
