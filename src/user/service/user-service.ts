import { conflict, notFound } from '../../core/errors.js';
import type { CreateUserInput, MembershipReference, User, UserPreferences, UserProfile, UserStatus } from '../domain/user.js';
import { canTransition, nextUserId } from '../domain/user.js';
import type { UserStorePort } from '../store/user-store.js';
import { InMemoryUserStore } from '../store/user-store.js';

export type UserEventPublisher = (type: string, userId: string, payload: Readonly<Record<string, unknown>>) => void;

export interface UserServiceOptions {
  readonly store?: UserStorePort;
  readonly eventPublisher?: UserEventPublisher;
}

/**
 * USR-007 — UserService. Owns the human account/profile layer. Authentication
 * owns credentials; Auth Identity owns the principal; Permission owns
 * authorization. The User Module references identityId but never imports
 * Authentication internals.
 */
export class UserService {
  private readonly store: UserStorePort;
  private readonly eventPublisher: UserEventPublisher;

  constructor(options: UserServiceOptions = {}) {
    this.store = options.store ?? new InMemoryUserStore();
    this.eventPublisher = options.eventPublisher ?? (() => undefined);
  }

  create(input: CreateUserInput): User {
    if (this.store.getByUsername(input.username)) throw conflict(`User "${input.username}" already exists`);
    if (this.store.getByIdentity(input.identityId)) throw conflict(`User for identity "${input.identityId}" already exists`);
    const now = new Date().toISOString();
    const user: User = {
      id: nextUserId(),
      identityId: input.identityId,
      username: input.username,
      status: input.status ?? 'pending',
      profile: input.profile,
      preferences: input.preferences ?? {},
      settings: {
        emailVerified: input.settings?.emailVerified ?? false,
        ...(input.settings?.email !== undefined ? { email: input.settings.email } : {}),
        twoFactorEnabled: input.settings?.twoFactorEnabled ?? false,
      },
      memberships: input.memberships ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.store.save(user);
    this.eventPublisher('user.created', user.id, { username: user.username });
    return user;
  }

  get(id: string): User {
    const user = this.store.get(id);
    if (!user) throw notFound(`User "${id}" not found`);
    return user;
  }

  getByIdentity(identityId: string): User | undefined {
    return this.store.getByIdentity(identityId);
  }

  getByUsername(username: string): User | undefined {
    return this.store.getByUsername(username);
  }

  list(): readonly User[] {
    return this.store.list();
  }

  /** USR-003 — lifecycle transitions with soft deletion (tombstoning). */
  transition(id: string, to: UserStatus): User {
    const user = this.get(id);
    if (!canTransition(user.status, to)) {
      throw conflict(`Cannot transition user "${id}" from "${user.status}" to "${to}"`);
    }
    const now = new Date().toISOString();
    const next: User = {
      ...user,
      status: to,
      updatedAt: now,
      ...(to === 'deleted' ? { deletedAt: now } : {}),
    };
    this.store.save(next);
    this.eventPublisher(`user.${to}`, id, {});
    return next;
  }

  updateProfile(id: string, profile: UserProfile): User {
    const user = this.get(id);
    const next: User = { ...user, profile, updatedAt: new Date().toISOString() };
    this.store.save(next);
    this.eventPublisher('user.profile.updated', id, {});
    return next;
  }

  updatePreferences(id: string, preferences: UserPreferences): User {
    const user = this.get(id);
    const next: User = { ...user, preferences: { ...user.preferences, ...preferences }, updatedAt: new Date().toISOString() };
    this.store.save(next);
    this.eventPublisher('user.preferences.updated', id, {});
    return next;
  }

  /** USR-014 — membership management. */
  addMembership(id: string, membership: MembershipReference): User {
    const user = this.get(id);
    if (user.memberships.some((m) => m.id === membership.id)) throw conflict(`Membership "${membership.id}" already exists`);
    const next: User = { ...user, memberships: [...user.memberships, membership], updatedAt: new Date().toISOString() };
    this.store.save(next);
    this.eventPublisher('user.membership.added', id, { organizationId: membership.organizationId });
    return next;
  }

  removeMembership(id: string, membershipId: string): User {
    const user = this.get(id);
    const next: User = { ...user, memberships: user.memberships.filter((m) => m.id !== membershipId), updatedAt: new Date().toISOString() };
    this.store.save(next);
    this.eventPublisher('user.membership.removed', id, {});
    return next;
  }

  remove(id: string): void {
    if (!this.store.get(id)) throw notFound(`User "${id}" not found`);
    this.store.remove(id);
  }
}
