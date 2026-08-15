/** USR-001..005 — User domain contracts. */

import { randomId } from '../../core/identifiers.js';

export type UserStatus = 'invited' | 'pending' | 'active' | 'suspended' | 'disabled' | 'deleting' | 'deleted';

/** USR-004 — human-facing profile metadata. */
export interface UserProfile {
  readonly displayName: string;
  readonly avatar?: string;
  readonly bio?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly language?: string;
  readonly location?: string;
  readonly jobTitle?: string;
  readonly organization?: string;
}

/** USR-005 — namespaced preferences. */
export interface UserPreferences {
  readonly 'ui.theme'?: string;
  readonly 'ui.appearance'?: string;
  readonly 'ui.language'?: string;
  readonly 'ui.timezone'?: string;
  readonly 'ui.dateFormat'?: string;
  readonly 'notifications.enabled'?: boolean;
  readonly 'ai.defaultProvider'?: string;
  readonly 'ai.defaultModel'?: string;
  readonly 'workspace.defaultWorkspace'?: string;
  readonly 'activityRoom.enabled'?: boolean;
  readonly 'accessibility.reduceMotion'?: boolean;
}

export interface UserSettings {
  readonly emailVerified: boolean;
  readonly email?: string;
  readonly twoFactorEnabled: boolean;
}

/** USR-014 — membership. A user belongs to organizations/workspaces via memberships + roles. */
export interface MembershipReference {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId?: string;
  readonly roleIds: readonly string[];
}

export interface User {
  readonly id: string;
  readonly identityId: string;
  readonly username: string;
  readonly status: UserStatus;
  readonly profile: UserProfile;
  readonly preferences: UserPreferences;
  readonly settings: UserSettings;
  readonly memberships: readonly MembershipReference[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
}

export interface CreateUserInput {
  readonly identityId: string;
  readonly username: string;
  readonly status?: UserStatus;
  readonly profile: UserProfile;
  readonly preferences?: UserPreferences;
  readonly settings?: Partial<UserSettings>;
  readonly memberships?: readonly MembershipReference[];
}

/** USR-003 — user lifecycle transitions. */
export const USER_LIFECYCLE_TRANSITIONS: Record<UserStatus, readonly UserStatus[]> = {
  invited: ['pending', 'deleted'],
  pending: ['active', 'suspended', 'disabled', 'deleted'],
  active: ['suspended', 'disabled', 'deleting'],
  suspended: ['active', 'disabled', 'deleted'],
  disabled: ['active', 'deleted'],
  deleting: ['deleted'],
  deleted: [],
};

export function canTransition(from: UserStatus, to: UserStatus): boolean {
  return USER_LIFECYCLE_TRANSITIONS[from].includes(to);
}

/** USR-002 — UserId. Machine identities (agent/service) do not resolve to a user. */
export function isHumanIdentity(principalKind: string): boolean {
  return principalKind === 'human';
}

export function nextUserId(): string {
  return randomId('user');
}
