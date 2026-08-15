/** USR-010..015 — User context + auth/permission/membership/session integrations. */

import type { MembershipReference } from '../domain/user.js';

export interface UserContext {
  readonly identityId: string;
  readonly userId?: string;
  readonly username?: string;
  readonly memberships: readonly MembershipReference[];
  readonly principalKind?: string;
}

export interface AuthenticationPort {
  resolveIdentity(identityId: string): Promise<{ principalKind: string; displayName?: string } | undefined>;
}

export interface OnboardingPort {
  complete(userId: string): Promise<void>;
}

/**
 * USR-010 — Authentication integration. Login -> Authentication -> Identity ->
 * User Resolver -> User -> AuthenticationContext. Machine/service/agent
 * identities do NOT resolve to a user.
 */
export class UserResolver {
  private readonly users: { getByIdentity(identityId: string): { id: string; username: string; memberships: readonly MembershipReference[] } | undefined };

  constructor(users: { getByIdentity(identityId: string): { id: string; username: string; memberships: readonly MembershipReference[] } | undefined }) {
    this.users = users;
  }

  resolve(identityId: string, principalKind: string): UserContext | undefined {
    if (principalKind !== 'human') {
      return { identityId, memberships: [], principalKind };
    }
    const user = this.users.getByIdentity(identityId);
    if (!user) return undefined;
    return {
      identityId,
      userId: user.id,
      username: user.username,
      memberships: user.memberships,
      principalKind: 'human',
    };
  }
}

/** USR-012 — Onboarding integration. First login: no user -> provision + onboard. */
export class UserProvisioner {
  private readonly users: { getByIdentity(identityId: string): { id: string } | undefined; create(input: { identityId: string; username: string; profile: { displayName: string } }): { id: string } };
  private readonly onboarding: OnboardingPort;

  constructor(
    users: { getByIdentity(identityId: string): { id: string } | undefined; create(input: { identityId: string; username: string; profile: { displayName: string } }): { id: string } },
    onboarding: OnboardingPort,
  ) {
    this.users = users;
    this.onboarding = onboarding;
  }

  async ensureUser(identityId: string, displayName: string): Promise<{ userId: string; created: boolean }> {
    const existing = this.users.getByIdentity(identityId);
    if (existing) return { userId: existing.id, created: false };
    const user = this.users.create({ identityId, username: `user_${identityId.slice(-6)}`, profile: { displayName: displayName || 'New User' } });
    await this.onboarding.complete(user.id);
    return { userId: user.id, created: true };
  }
}
