/** OS-002 — OS identity + distribution discovery. */

import { hostname } from 'node:os';
import type { OsDistributionId, OsIdentity, OsPackageManagerKind } from '../domain/os-profile.js';

export interface DistributionDiscoveryResult {
  readonly distributionId: OsDistributionId;
  readonly osName: string;
  readonly osVersion: string;
  readonly osPrettyName?: string;
  readonly codename?: string;
  readonly packageManager: OsPackageManagerKind;
  readonly versionId?: string;
}

export interface DistributionDiscoveryPort {
  discover(): Promise<DistributionDiscoveryResult>;
}

const PACKAGE_MANAGER_BY_ID: Record<OsDistributionId, OsPackageManagerKind> = {
  debian: 'apt',
  ubuntu: 'apt',
  fedora: 'dnf',
  arch: 'pacman',
  'generic-linux': 'generic',
  unknown: 'generic',
};

/**
 * OS-002 — Distribution discovery. Reads /etc/os-release and classifies the
 * distribution + package manager WITHOUT encoding adapter assumptions in the
 * domain contract.
 */
export class DistributionDiscovery implements DistributionDiscoveryPort {
  async discover(): Promise<DistributionDiscoveryResult> {
    const release = await this.readOsRelease();
    const distributionId = normalizeDistributionId(release.ID);
    return {
      distributionId,
      osName: release.NAME ?? 'Linux',
      osVersion: release.VERSION_ID ?? 'unknown',
      ...(release.PRETTY_NAME !== undefined ? { osPrettyName: release.PRETTY_NAME } : {}),
      ...(release.VERSION_CODENAME !== undefined ? { codename: release.VERSION_CODENAME } : {}),
      packageManager: PACKAGE_MANAGER_BY_ID[distributionId],
      ...(release.VERSION_ID !== undefined ? { versionId: release.VERSION_ID } : {}),
    };
  }

  private async readOsRelease(): Promise<Record<string, string>> {
    try {
      const fs = await import('node:fs/promises');
      const content = await fs.readFile('/etc/os-release', 'utf8');
      const result: Record<string, string> = {};
      for (const line of content.split('\n')) {
        const match = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/);
        if (match) result[match[1]!] = match[2]!;
      }
      return result;
    } catch {
      return { ID: 'generic-linux', NAME: 'Linux', VERSION_ID: 'unknown' };
    }
  }
}

function normalizeDistributionId(id: string | undefined): OsDistributionId {
  switch ((id ?? '').toLowerCase()) {
    case 'debian':
      return 'debian';
    case 'ubuntu':
      return 'ubuntu';
    case 'fedora':
      return 'fedora';
    case 'arch':
    case 'archlinux':
      return 'arch';
    case '':
      return 'unknown';
    default:
      return 'generic-linux';
  }
}

/** OS-002 — Full OS identity from the environment (hostname + distribution + kernel). */
export function buildOsIdentity(result: DistributionDiscoveryResult, kernelRelease: string, architecture: string): OsIdentity {
  return {
    hostname: hostname(),
    osId: result.distributionId,
    osName: result.osName,
    osVersion: result.osVersion,
    ...(result.osPrettyName !== undefined ? { osPrettyName: result.osPrettyName } : {}),
    kernelRelease,
    architecture,
    distributionId: result.distributionId,
    ...(result.versionId !== undefined ? { distributionVersion: result.versionId } : {}),
    packageManager: result.packageManager,
  };
}
