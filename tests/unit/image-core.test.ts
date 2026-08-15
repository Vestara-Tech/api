import { describe, expect, it } from 'vitest';
import { withProfileHash, hashImageProfile, type VestaraImageProfile } from '../../src/image/domain/profile.js';
import { ImageProfileRegistry, DESKTOP_PROFILE, SERVER_PROFILE } from '../../src/image/domain/registry.js';
import { compileBuildPlan } from '../../src/image/domain/build-plan.js';
import { stageOrder } from '../../src/image/domain/lifecycle.js';

function baseProfile(): Omit<VestaraImageProfile, 'profileHash'> {
  return {
    id: 'test',
    version: '0.1.0',
    architecture: 'amd64',
    base: { distribution: 'debian', release: 'trixie', kernel: 'default' },
    boot: { grub: { enabled: true, timeout: 3, theme: 'vestara-dark' }, plymouth: { enabled: true, theme: 'vestara' }, firmwareLogo: { mode: 'runtime-if-supported' } },
    system: { abSlots: true, recovery: true },
    applications: { applications: ['@vestara/app-startup'] },
    onboarding: { firstBoot: true },
    login: { provider: 'vestara', password: true, fingerprint: 'auto', fido2: 'auto' },
    desktop: { session: 'vestara', startupApp: '@vestara/app-startup', desktopApp: '@vestara/app-desktop' },
    packages: { extraPackages: [] },
    security: { noDefaultOwner: true, sanitizeSecrets: true },
    recovery: { enabled: true, includes: ['startup'] },
  };
}

describe('image profile + registry (IMG-001/002)', () => {
  it('computes a deterministic profile hash', () => {
    const a = withProfileHash(baseProfile());
    const b = withProfileHash(baseProfile());
    expect(a.profileHash).toBe(b.profileHash);
    expect(a.profileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashImageProfile(baseProfile())).toBe(a.profileHash);
  });

  it('registers defaults and rejects duplicates', () => {
    const registry = new ImageProfileRegistry();
    registry.registerDefaults();
    expect(registry.has('vestara-desktop')).toBe(true);
    expect(registry.has('vestara-server')).toBe(true);
    expect(registry.get('vestara-server').system.abSlots).toBe(true);
    expect(() => registry.register(DESKTOP_PROFILE)).toThrow();
  });

  it('lists profiles sorted by id', () => {
    const registry = new ImageProfileRegistry();
    registry.registerDefaults();
    expect(registry.list().map((p) => p.id)).toEqual(['vestara-desktop', 'vestara-server']);
  });
});

describe('build plan compiler (IMG-003)', () => {
  it('compiles a deterministic ordered plan', () => {
    const profile = withProfileHash(baseProfile());
    const plan = compileBuildPlan(profile, 'raw');
    expect(plan.profileId).toBe('test');
    expect(plan.planHash).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.items.length).toBe(stageOrder().length);
    expect(plan.items[0]!.stage).toBe('resolve-profile');
    expect(plan.items[plan.items.length - 1]!.stage).toBe('export');
  });

  it('generates the same plan hash for the same profile', () => {
    const profile = withProfileHash(baseProfile());
    expect(compileBuildPlan(profile, 'raw').planHash).toBe(compileBuildPlan(profile, 'raw').planHash);
  });

  it('embeds the application list in install-apps', () => {
    const profile = withProfileHash(baseProfile());
    const plan = compileBuildPlan(profile, 'raw');
    const installApps = plan.items.find((i) => i.stage === 'install-apps')!;
    expect(installApps.generated).toContain('@vestara/app-startup');
  });

  it('produces the right artifact extension per target', () => {
    const profile = withProfileHash(baseProfile());
    const iso = compileBuildPlan(profile, 'installer');
    expect(iso.items[iso.items.length - 1]!.generated[0]).toContain('.iso');
    const img = compileBuildPlan(profile, 'raw');
    expect(img.items[img.items.length - 1]!.generated[0]).toContain('.img');
  });
});
