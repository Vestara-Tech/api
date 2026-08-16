import { conflict, notFound } from '../../core/errors.js';

export type PackageChannel = 'stable' | 'beta' | 'development' | 'canary';

export interface PackageVersionEntry {
  readonly packageId: string;
  readonly version: string;
  readonly channel: PackageChannel;
  readonly publishedAt: string;
  readonly changelog?: string;
}

export interface VersionStorePort {
  add(entry: PackageVersionEntry): void;
  list(packageId: string): readonly PackageVersionEntry[];
  latest(packageId: string, channel: PackageChannel): PackageVersionEntry | undefined;
  channels(packageId: string): readonly PackageChannel[];
}

/** MKT2-018 — Version store. A package may have multiple versions across channels. */
export function compareVersions(a: string, b: string): number {
  const numA = a.split(/[^0-9]+/).map((n) => Number.parseInt(n, 10) || 0);
  const numB = b.split(/[^0-9]+/).map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(numA.length, numB.length); i += 1) {
    const diff = (numA[i] ?? 0) - (numB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export class InMemoryVersionStore implements VersionStorePort {
  private readonly versions = new Map<string, PackageVersionEntry[]>();

  add(entry: PackageVersionEntry): void {
    const list = this.versions.get(entry.packageId) ?? [];
    if (list.some((v) => v.version === entry.version && v.channel === entry.channel)) {
      throw conflict(`Version "${entry.packageId}@${entry.version}" already published on ${entry.channel}`);
    }
    list.push(entry);
    this.versions.set(entry.packageId, list);
  }

  list(packageId: string): readonly PackageVersionEntry[] {
    return [...(this.versions.get(packageId) ?? [])].sort(
      (a, b) => b.publishedAt.localeCompare(a.publishedAt) || compareVersions(b.version, a.version),
    );
  }

  latest(packageId: string, channel: PackageChannel): PackageVersionEntry | undefined {
    return this.list(packageId).find((v) => v.channel === channel);
  }

  channels(packageId: string): readonly PackageChannel[] {
    return [...new Set((this.versions.get(packageId) ?? []).map((v) => v.channel))];
  }
}

export interface PackageVersionServiceOptions {
  readonly store?: VersionStorePort;
}

/**
 * MKT2-018 — Version/channel management. Versions are published to a channel;
 * the latest version of a channel is what installs resolve to. Promotion moves
 * a version between channels.
 */
export class PackageVersionService {
  private readonly store: VersionStorePort;

  constructor(options: PackageVersionServiceOptions = {}) {
    this.store = options.store ?? new InMemoryVersionStore();
  }

  publish(entry: Omit<PackageVersionEntry, 'publishedAt'> & { publishedAt?: string }): PackageVersionEntry {
    const full: PackageVersionEntry = { ...entry, publishedAt: entry.publishedAt ?? new Date().toISOString() };
    this.store.add(full);
    return full;
  }

  /** Promote a published version to another channel (e.g. beta -> stable). */
  promote(packageId: string, version: string, to: PackageChannel, changelog?: string): PackageVersionEntry {
    const existing = this.store.list(packageId).find((v) => v.version === version);
    if (!existing) throw notFound(`Version "${packageId}@${version}" not found`);
    const promoted: PackageVersionEntry = { packageId, version, channel: to, publishedAt: new Date().toISOString(), ...(changelog !== undefined ? { changelog } : {}) };
    this.store.add(promoted);
    return promoted;
  }

  listVersions(packageId: string): readonly PackageVersionEntry[] {
    return this.store.list(packageId);
  }

  latestForChannel(packageId: string, channel: PackageChannel): PackageVersionEntry | undefined {
    return this.store.latest(packageId, channel);
  }

  channels(packageId: string): readonly PackageChannel[] {
    return this.store.channels(packageId);
  }
}
