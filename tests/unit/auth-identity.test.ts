import { describe, expect, it } from 'vitest';
import { IdentityService, externalSubjectKey } from '../../src/auth/service/identity-service.js';
import { InMemoryIdentityStore } from '../../src/auth/store/in-memory-identity.js';

describe('IdentityService', () => {
  it('creates a human identity with defaults', async () => {
    const service = new IdentityService({ store: new InMemoryIdentityStore() });
    const identity = await service.create({ displayName: 'Eddie' });
    expect(identity.principalKind).toBe('human');
    expect(identity.status).toBe('active');
    expect(identity.credentials).toEqual([]);
    expect(identity.externalIdentities).toEqual([]);
  });

  it('links an external identity by (integration, subject), not email', async () => {
    const service = new IdentityService({ store: new InMemoryIdentityStore() });
    const identity = await service.create({ displayName: 'Eddie', primaryEmail: 'eddie@example.com' });

    const linked = await service.linkExternal(identity.id, {
      integrationId: 'identity.github',
      provider: 'github',
      providerSubject: 'octocat-123',
      email: 'eddie@example.com',
      emailVerified: true,
      displayName: 'Eddie',
    });

    expect(linked.externalIdentities).toHaveLength(1);
    expect(linked.externalIdentities[0]!.integrationId).toBe('identity.github');

    const found = await service.findByExternal('identity.github', 'octocat-123');
    expect(found?.id).toBe(identity.id);
    expect(found?.externalIdentities[0]?.email).toBe('eddie@example.com');
  });

  it('resolves identities by a stable subject key', () => {
    expect(externalSubjectKey('identity.github', 'octocat-123')).toBe('identity.github::octocat-123');
  });

  it('rejects linking an external subject already owned by another identity', async () => {
    const service = new IdentityService({ store: new InMemoryIdentityStore() });
    const a = await service.create();
    const b = await service.create();
    await service.linkExternal(a.id, { integrationId: 'identity.google', provider: 'google', providerSubject: 'g-1' });
    await expect(
      service.linkExternal(b.id, { integrationId: 'identity.google', provider: 'google', providerSubject: 'g-1' }),
    ).rejects.toThrow();
  });
});
