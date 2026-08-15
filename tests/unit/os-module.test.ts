import { describe, expect, it } from 'vitest';
import { buildOsIdentity, diffOsProfiles, planOsChanges, OsService, EnvironmentOsDiscovery, DistributionDiscovery, OS_CAPABILITIES, hasOsCapability, FORBIDDEN_OS_OPERATIONS, type OsProfile, type DistributionDiscoveryResult } from '../../src/os/index.js';

function baseProfile(): OsProfile {
  return {
    identity: {
      hostname: 'host', osId: 'debian', osName: 'Debian', osVersion: '13', kernelRelease: '6.1',
      distributionId: 'debian', distributionVersion: '13', packageManager: 'apt', architecture: 'amd64',
    },
    distribution: { id: 'debian', version: '13', codename: 'trixie', repositories: [], packageManager: 'apt' },
    kernel: { release: '6.1', parameters: ['quiet'], modules: [], initramfs: { enabled: true }, updatePolicy: 'recommended' },
    packages: { packages: [{ name: 'curl', version: '8.0', state: 'installed' }], repositories: [] },
    services: { services: [{ name: 'vestara-api.service', state: 'enabled', loadState: 'loaded' }] },
    users: [],
    startup: { target: 'vestara.target', services: [], dependencies: [], timeoutSeconds: 30, presentation: 'vestara', failurePolicy: 'continue' },
    login: { provider: 'vestara', allowPassword: true, allowPin: false, allowPasskey: false, allowAutoLogin: false, allowGuest: false, allowRecovery: true },
    desktop: { environment: 'vestara', theme: 'vestara-dark', wallpaper: 'default', fonts: [], icons: 'default', cursor: 'default', panels: [], launcher: 'vestara', workspaceCount: 1, startupApplications: [], lockScreen: 'default' },
    network: { hostname: 'host', interfaces: [] },
    locale: { language: 'en', locale: 'C.UTF-8', timezone: 'UTC', keymap: 'us' },
    security: { lockdown: 'standard', firewalld: false, selinux: 'disabled', unattendedUpgrades: false, secureBootPolicy: 'optional' },
    updates: { channel: 'stable', automatic: false, autoUpgrade: false, rebootPolicy: 'ask', rollbackOnBootFailure: true },
    recovery: { enabled: false, partition: '', includes: [], autoRepair: false },
  };
}

function mutate(profile: OsProfile, patch: Partial<OsProfile>): OsProfile {
  return { ...profile, ...patch };
}

describe('OS-002 distribution + identity discovery', () => {
  it('classifies a distribution and builds identity without encoding adapter assumptions', () => {
    const result: DistributionDiscoveryResult = {
      distributionId: 'debian', osName: 'Debian GNU/Linux', osVersion: '13', osPrettyName: 'Debian GNU/Linux 13 (trixie)',
      codename: 'trixie', packageManager: 'apt', versionId: '13',
    };
    const identity = buildOsIdentity(result, '6.1.0', 'amd64');
    expect(identity.distributionId).toBe('debian');
    expect(identity.packageManager).toBe('apt');
    expect(identity.hostname).toBeTruthy();
  });

  it('discovers current state from the environment', async () => {
    const discovery = new EnvironmentOsDiscovery();
    const current = await discovery.discoverCurrent();
    expect(current.profile.identity.hostname).toBeTruthy();
    expect(current.lifecycle.state).toBe('running');
    expect(current.capturedAt).toBeTruthy();
  });
});

describe('OS-006 diff engine', () => {
  it('detects drift across categories', () => {
    const current = baseProfile();
    const desired = mutate(current, {
      locale: { ...current.locale, timezone: 'Asia/Manila' },
      desktop: { ...current.desktop, theme: 'vestara-light' },
      packages: {
        ...current.packages,
        packages: [{ name: 'curl', version: '8.1', state: 'installed' }, { name: 'nodejs', version: '24', state: 'installed' }],
      },
    });
    const diff = diffOsProfiles(current, desired);
    const keys = diff.entries.map((e) => e.key);
    expect(keys).toContain('locale.timezone');
    expect(keys).toContain('desktop.theme');
    expect(keys).toContain('packages.curl');
    expect(keys).toContain('packages.nodejs');
  });

  it('reports no drift for identical profiles', () => {
    const current = baseProfile();
    expect(diffOsProfiles(current, baseProfile()).entries).toHaveLength(0);
  });

  it('detects removed packages and users', () => {
    const current = baseProfile();
    const desired = mutate(current, {
      packages: { ...current.packages, packages: [] },
      users: [{ username: 'eddie', groups: [], autoLogin: false }],
    });
    const diff = diffOsProfiles(current, desired);
    expect(diff.entries.some((e) => e.key === 'packages.curl')).toBe(true);
    expect(diff.entries.some((e) => e.key === 'users.eddie')).toBe(true);
  });
});

describe('OS-007 change planner', () => {
  it('plans install/upgrade/remove with risk and approval', () => {
    const current = baseProfile();
    const desired = mutate(current, {
      packages: {
        ...current.packages,
        packages: [{ name: 'curl', version: '8.1', state: 'installed' }, { name: 'nodejs', version: '24', state: 'installed' }],
      },
      kernel: { ...current.kernel, updatePolicy: 'all' },
    });
    const plan = planOsChanges(diffOsProfiles(current, desired));
    expect(plan.changes.length).toBeGreaterThanOrEqual(3);
    expect(plan.changes.some((c) => c.kind === 'install' && c.target === 'packages.nodejs')).toBe(true);
    expect(plan.changes.some((c) => c.kind === 'upgrade' && c.target === 'packages.curl')).toBe(true);
    expect(plan.requiresApproval).toBe(true);
    expect(plan.totalRisk).toBeDefined();
    expect(plan.planHash).toBeTruthy();
  });

  it('plans kernel changes as reboot-requiring and system-gated', () => {
    const current = baseProfile();
    const desired = mutate(current, { kernel: { ...current.kernel, parameters: ['quiet', 'splash'] } });
    const plan = planOsChanges(diffOsProfiles(current, desired));
    const kernelChange = plan.changes.find((c) => c.category === 'kernel')!;
    expect(kernelChange.requiresReboot).toBe(true);
    expect(kernelChange.requiresApproval).toBe(true);
  });

  it('marks user deletion as high risk requiring approval', () => {
    const current = mutate(baseProfile(), { users: [{ username: 'eddie', groups: [], autoLogin: false }] });
    const desired = mutate(baseProfile(), { users: [] });
    const plan = planOsChanges(diffOsProfiles(current, desired));
    const deleteChange = plan.changes.find((c) => c.kind === 'delete')!;
    expect(deleteChange.risk).toBe('high');
    expect(deleteChange.requiresApproval).toBe(true);
  });
});

describe('OS-003 capabilities', () => {
  it('exposes safe read capabilities and governed write capabilities', () => {
    expect(hasOsCapability('os.inspect')).toBe(true);
    expect(hasOsCapability('os.update.plan')).toBe(true);
    expect(hasOsCapability('os.package.install')).toBe(true);
    expect(hasOsCapability('os.update.apply')).toBe(true);
    const install = OS_CAPABILITIES.find((c) => c.id === 'os.package.install')!;
    expect(install.requiresApproval).toBe(true);
    const inspect = OS_CAPABILITIES.find((c) => c.id === 'os.inspect')!;
    expect(inspect.requiresApproval).toBe(false);
  });

  it('forbids arbitrary root operations', () => {
    expect(FORBIDDEN_OS_OPERATIONS).toContain('os.shell.root');
    expect(FORBIDDEN_OS_OPERATIONS).toContain('os.exec.arbitrary');
  });
});

describe('OS service: desired state -> state model -> diff -> plan', () => {
  it('declares desired state and computes drift', async () => {
    const service = new OsService();
    const current = await service.current();
    const desired = service.setDesired(mutate(current.profile, { locale: { ...current.profile.locale, timezone: 'Asia/Manila' } }));
    expect(desired.revision).toBe(1);

    const model = await service.stateModel();
    expect(model.driftCount).toBeGreaterThan(0);

    const diff = await service.diff();
    expect(diff.entries.some((e) => e.key === 'locale.timezone')).toBe(true);

    const plan = await service.plan();
    expect(plan.changes.length).toBeGreaterThan(0);
  });
});
