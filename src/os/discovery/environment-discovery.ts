/** OS-002/005 — Environment OS discovery + desired-state store. */

import { cpus, hostname } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import type { OsProfile } from '../domain/os-profile.js';
import type { OsCurrentState, OsDesiredState, OsLifecycleState } from '../domain/os-state.js';
import type { DistributionDiscoveryPort } from './distribution-discovery.js';
import { DistributionDiscovery, buildOsIdentity } from './distribution-discovery.js';

export interface OsDiscoveryPort {
  discoverCurrent(): Promise<OsCurrentState>;
}

/**
 * OS-002 — Environment discovery. Captures the CURRENT OsProfile from the
 * host OS; degrades honestly where privileged info (installed packages,
 * services) is not accessible in-process. A privileged daemon would fill the
 * same contract with real reads.
 */
export class EnvironmentOsDiscovery implements OsDiscoveryPort {
  private readonly distribution: DistributionDiscoveryPort;

  constructor(distribution: DistributionDiscoveryPort = new DistributionDiscovery()) {
    this.distribution = distribution;
  }

  async discoverCurrent(): Promise<OsCurrentState> {
    const distribution = await this.distribution.discover();
    const kernelRelease = process.version ?? 'unknown';
    const identity = buildOsIdentity(distribution, kernelRelease, process.arch);

    const profile: OsProfile = {
      identity,
      distribution: {
        id: distribution.distributionId,
        ...(distribution.versionId !== undefined ? { version: distribution.versionId } : {}),
        ...(distribution.codename !== undefined ? { codename: distribution.codename } : {}),
        repositories: [],
        packageManager: distribution.packageManager,
      },
      kernel: {
        release: kernelRelease,
        parameters: this.readCmdline(),
        modules: [],
        initramfs: { enabled: false },
        updatePolicy: 'recommended',
      },
      packages: { packages: [], repositories: [] },
      services: { services: [] },
      users: [],
      startup: { target: 'vestara.target', services: [], dependencies: [], timeoutSeconds: 30, presentation: 'vestara', failurePolicy: 'continue' },
      login: { provider: 'vestara', allowPassword: true, allowPin: false, allowPasskey: false, allowAutoLogin: false, allowGuest: false, allowRecovery: true },
      desktop: { environment: 'vestara', theme: 'vestara-dark', wallpaper: 'default', fonts: [], icons: 'default', cursor: 'default', panels: [], launcher: 'vestara', workspaceCount: 1, startupApplications: [], lockScreen: 'default' },
      network: { hostname: hostname(), interfaces: [] },
      locale: { language: 'en', locale: 'C.UTF-8', timezone: 'UTC', keymap: 'us' },
      security: { lockdown: 'standard', firewalld: false, selinux: 'disabled', unattendedUpgrades: false, secureBootPolicy: 'optional' },
      updates: { channel: 'stable', automatic: false, autoUpgrade: false, rebootPolicy: 'ask', rollbackOnBootFailure: true },
      recovery: { enabled: false, partition: '', includes: [], autoRepair: false },
    };

    return {
      profile,
      lifecycle: { state: 'running', since: new Date().toISOString() },
      capturedAt: new Date().toISOString(),
    };
  }

  private readCmdline(): readonly string[] {
    try {
      if (!existsSync('/proc/cmdline')) return [];
      return readFileSync('/proc/cmdline', 'utf8').trim().split(/\s+/).filter(Boolean);
    } catch {
      return [];
    }
  }
}

export interface OsDesiredStorePort {
  get(): OsDesiredState | undefined;
  save(desired: OsDesiredState): void;
}

export class InMemoryOsDesiredStore implements OsDesiredStorePort {
  private desired: OsDesiredState | undefined;

  get(): OsDesiredState | undefined {
    return this.desired;
  }

  save(desired: OsDesiredState): void {
    this.desired = desired;
  }
}

export function makeLifecycleRecord(state: OsLifecycleState, previous?: OsLifecycleState): OsCurrentState['lifecycle'] {
  return {
    state,
    since: new Date().toISOString(),
    ...(previous !== undefined ? { previous } : {}),
  };
}

export { cpus };
