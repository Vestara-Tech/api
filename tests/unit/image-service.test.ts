import { describe, expect, it } from 'vitest';
import { ImageBuildService } from '../../src/image/service/image-build-service.js';
import { withProfileHash, type VestaraImageProfile } from '../../src/image/domain/profile.js';

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

describe('ImageBuildService (IMG-004)', () => {
  it('lists built-in profiles', () => {
    const service = new ImageBuildService();
    expect(service.listProfiles().map((p) => p.id)).toEqual(['vestara-desktop', 'vestara-server']);
  });

  it('registers a profile and plans a build', () => {
    const service = new ImageBuildService();
    const profile = service.registerProfile(baseProfile());
    expect(profile.profileHash).toMatch(/^[a-f0-9]{64}$/);
    const plan = service.plan('test', 'raw');
    expect(plan.profileId).toBe('test');
    expect(plan.items.length).toBeGreaterThan(10);
  });

  it('rejects a build without approval', async () => {
    const service = new ImageBuildService();
    service.registerProfile(baseProfile());
    await expect(service.build('test', 'raw', false)).rejects.toThrow(/approval/i);
  });

  it('runs a governed build to completion (dev adapters degrade gracefully)', async () => {
    const service = new ImageBuildService();
    service.registerProfile(baseProfile());
    const result = await service.build('test', 'raw', true);
    expect(result.state.status).toBe('completed');
    expect(result.state.completedStages.length).toBeGreaterThan(10);
    expect(result.evidence.artifactPath).toContain('.img');
    expect(result.evidence.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces an evidence hash chained to the plan and profile', async () => {
    const service = new ImageBuildService();
    service.registerProfile(baseProfile());
    const result = await service.build('test', 'raw', true);
    // Evidence is chained to plan + profile (deterministic), with a unique buildId.
    expect(result.evidence.planHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.evidence.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.evidence.planHash).toBe(service.plan('test', 'raw').planHash);
  });
});
