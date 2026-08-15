/** IMG-057/058 — Publishing and release history. */

import { hashOf } from '../../generator/domain/hash.js';

export type PublishTarget = 'local-artifact' | 'marketplace' | 'release-repository' | 'usb-writer' | 'pxe-repository' | 'cloud-registry';

export type ReleaseStatus = 'draft' | 'publishing' | 'published' | 'superseded' | 'withdrawn';

export interface ReleaseRecord {
  readonly id: string;
  readonly profileId: string;
  readonly version: string;
  readonly buildId: string;
  readonly verified: boolean;
  readonly signed: boolean;
  readonly sealed: boolean;
  readonly target: PublishTarget;
  readonly status: ReleaseStatus;
  readonly publishedAt?: string;
  readonly supersededBy?: string;
  readonly artifactPath: string;
  readonly evidenceBundleHash: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface PublishRequest {
  readonly profileId: string;
  readonly version: string;
  readonly buildId: string;
  readonly verified: boolean;
  readonly signed: boolean;
  readonly sealed: boolean;
  readonly artifactPath: string;
  readonly evidenceBundleHash: string;
  readonly target?: PublishTarget;
  readonly allowUnverifiedDevBuild?: boolean;
}

export type PublishVerdict = 'published' | 'refused-unverified' | 'refused-unsigned' | 'refused-unsealed' | 'invalid';

export interface PublishResult {
  readonly verdict: PublishVerdict;
  readonly release?: ReleaseRecord;
  readonly reason?: string;
}

export interface ReleaseStorePort {
  save(release: ReleaseRecord): void;
  list(): readonly ReleaseRecord[];
  get(id: string): ReleaseRecord | undefined;
}

export class InMemoryReleaseStore implements ReleaseStorePort {
  private readonly releases = new Map<string, ReleaseRecord>();

  save(release: ReleaseRecord): void {
    this.releases.set(release.id, release);
  }

  list(): readonly ReleaseRecord[] {
    return [...this.releases.values()].sort((a, b) => (b.publishedAt ?? b.id).localeCompare(a.publishedAt ?? a.id));
  }

  get(id: string): ReleaseRecord | undefined {
    return this.releases.get(id);
  }
}

/**
 * IMG-057/058 — Publishing. An unverified build is refused unless policy
 * explicitly permits development artifacts. Publishing records a release in
 * history and supersedes prior releases of the same profile.
 */
export class ReleasePublisher {
  private readonly store: ReleaseStorePort;

  constructor(store: ReleaseStorePort = new InMemoryReleaseStore()) {
    this.store = store;
  }

  publish(request: PublishRequest): PublishResult {
    if (request.target !== 'local-artifact' && !request.verified && !request.allowUnverifiedDevBuild) {
      return { verdict: 'refused-unverified', reason: 'Build is not boot-verified; publishing refuses unverified builds unless policy permits dev artifacts' };
    }
    if (!request.signed && !request.allowUnverifiedDevBuild) {
      return { verdict: 'refused-unsigned', reason: 'Artifact is not signed' };
    }
    if (!request.sealed) {
      return { verdict: 'refused-unsealed', reason: 'Artifact is not sealed' };
    }
    if (!request.buildId || !request.artifactPath) {
      return { verdict: 'invalid', reason: 'Build id and artifact path are required' };
    }

    const now = new Date().toISOString();
    const release: ReleaseRecord = {
      id: `release_${hashOf({ profileId: request.profileId, version: request.version, buildId: request.buildId }).slice(0, 12)}`,
      profileId: request.profileId,
      version: request.version,
      buildId: request.buildId,
      verified: request.verified,
      signed: request.signed,
      sealed: request.sealed,
      target: request.target ?? 'local-artifact',
      status: 'published',
      publishedAt: now,
      artifactPath: request.artifactPath,
      evidenceBundleHash: request.evidenceBundleHash,
      metadata: {},
    };

    // Supersede prior published releases of the same profile.
    for (const prior of this.store.list().filter((r) => r.profileId === request.profileId && r.status === 'published')) {
      this.store.save({ ...prior, status: 'superseded', supersededBy: release.id });
    }

    this.store.save(release);
    return { verdict: 'published', release };
  }

  releaseHistory(profileId: string): readonly ReleaseRecord[] {
    return this.store.list().filter((r) => r.profileId === profileId);
  }

  releases(): readonly ReleaseRecord[] {
    return this.store.list();
  }

  withdraw(id: string): ReleaseRecord | undefined {
    const release = this.store.get(id);
    if (!release) return undefined;
    const updated: ReleaseRecord = { ...release, status: 'withdrawn' };
    this.store.save(updated);
    return updated;
  }
}
