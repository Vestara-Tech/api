import { notFound } from '../../core/errors.js';
import { randomId } from '../../core/identifiers.js';
import type { CreateIdentityInput, ExternalIdentity, Identity } from '../domain/identity.js';
import type { IdentityStore } from '../store/identity-store.js';

export interface IdentityServiceOptions {
  readonly store: IdentityStore;
}

/** Stable external subject key: `(integration, provider subject)` — not email. */
export function externalSubjectKey(integrationId: string, providerSubject: string): string {
  return `${integrationId}::${providerSubject}`;
}

export class IdentityService {
  private readonly store: IdentityStore;

  constructor(options: IdentityServiceOptions) {
    this.store = options.store;
  }

  async create(input: CreateIdentityInput = {}): Promise<Identity> {
    const now = new Date().toISOString();
    const identity: Identity = {
      id: randomId('idn'),
      principalKind: input.principalKind ?? 'human',
      status: 'active',
      profile: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.primaryEmail !== undefined ? { primaryEmail: input.primaryEmail } : {}),
        ...(input.pictureUrl !== undefined ? { pictureUrl: input.pictureUrl } : {}),
      },
      credentials: [],
      externalIdentities: [],
      memberships: [],
      roles: input.roles ?? [],
      permissions: input.permissions ?? [],
      createdAt: now,
      updatedAt: now,
    };
    return this.store.create(identity);
  }

  async get(id: string): Promise<Identity> {
    const identity = await this.store.get(id);
    if (!identity) throw notFound(`Identity "${id}" not found`);
    return identity;
  }

  async list(): Promise<readonly Identity[]> {
    return this.store.list();
  }

  /**
   * Link an external identity to a Vestara identity, keyed by
   * `(integrationId, providerSubject)`, never by email. Linking is idempotent:
   * if the subject is already linked to this identity, it is a no-op.
   */
  async linkExternal(identityId: string, external: Omit<ExternalIdentity, 'id' | 'linkedAt'>): Promise<Identity> {
    const identity = await this.get(identityId);
    const subjectKey = externalSubjectKey(external.integrationId, external.providerSubject);
    const existing = await this.store.getByExternal(subjectKey);
    if (existing && existing.id !== identityId) {
      throw new Error(`External identity "${subjectKey}" is already linked to another identity`);
    }

    const now = new Date().toISOString();
    const linked: ExternalIdentity = { ...external, id: randomId('ext'), linkedAt: now };
    const updated: Identity = {
      ...identity,
      externalIdentities: [...identity.externalIdentities, linked],
      updatedAt: now,
    };
    await this.store.save(updated);
    await this.store.indexExternal(identityId, subjectKey);
    return updated;
  }

  /** Resolve a Vestara identity from a stable external subject key. */
  async findByExternal(integrationId: string, providerSubject: string): Promise<Identity | null> {
    return this.store.getByExternal(externalSubjectKey(integrationId, providerSubject));
  }
}
