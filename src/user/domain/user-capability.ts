/** USR-009 — User capabilities. */

export type UserCapabilityKind = 'read' | 'write' | 'governed';

export interface UserCapabilityDefinition {
  readonly id: string;
  readonly kind: UserCapabilityKind;
  readonly risk: 'low' | 'medium' | 'high';
  readonly requiresApproval: boolean;
  readonly description: string;
}

/**
 * USR-009 — User capabilities. Read/self-service capabilities are broadly
 * available; user lifecycle management is governed. User Module owns the
 * human account/profile; Authentication owns credentials; Permission owns
 * authorization.
 */
export const USER_CAPABILITIES: readonly UserCapabilityDefinition[] = [
  { id: 'user.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read user accounts' },
  { id: 'user.self.profile', kind: 'write', risk: 'low', requiresApproval: false, description: 'Manage own profile' },
  { id: 'user.self.preferences', kind: 'write', risk: 'low', requiresApproval: false, description: 'Manage own preferences' },
  { id: 'user.invite', kind: 'governed', risk: 'medium', requiresApproval: true, description: 'Invite users' },
  { id: 'user.create', kind: 'governed', risk: 'medium', requiresApproval: true, description: 'Provision users' },
  { id: 'user.suspend', kind: 'governed', risk: 'high', requiresApproval: true, description: 'Suspend users' },
  { id: 'user.delete', kind: 'governed', risk: 'high', requiresApproval: true, description: 'Delete users (soft)' },
  { id: 'user.membership', kind: 'governed', risk: 'medium', requiresApproval: true, description: 'Manage memberships' },
];

export function getUserCapability(id: string): UserCapabilityDefinition | undefined {
  return USER_CAPABILITIES.find((c) => c.id === id);
}

export function hasUserCapability(id: string): boolean {
  return USER_CAPABILITIES.some((c) => c.id === id);
}
