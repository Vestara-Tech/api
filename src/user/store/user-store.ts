/** USR-006 — User store ports. */

import type { User } from '../domain/user.js';

export interface UserStorePort {
  save(user: User): void;
  get(id: string): User | undefined;
  getByIdentity(identityId: string): User | undefined;
  getByUsername(username: string): User | undefined;
  list(): readonly User[];
  remove(id: string): void;
}

export class InMemoryUserStore implements UserStorePort {
  private readonly users = new Map<string, User>();

  save(user: User): void {
    this.users.set(user.id, user);
  }

  get(id: string): User | undefined {
    return this.users.get(id);
  }

  getByIdentity(identityId: string): User | undefined {
    return [...this.users.values()].find((u) => u.identityId === identityId);
  }

  getByUsername(username: string): User | undefined {
    return [...this.users.values()].find((u) => u.username === username);
  }

  list(): readonly User[] {
    return [...this.users.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  remove(id: string): void {
    this.users.delete(id);
  }
}
