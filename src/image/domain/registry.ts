import { conflict, notFound } from '../../core/errors.js';
import type { VestaraImageProfile } from './profile.js';

/**
 * IMG-002 — Image profile registry. Profiles are versioned manifests
 * describing intent (never arbitrary shell commands).
 */
export class ImageProfileRegistry {
  private readonly profiles = new Map<string, VestaraImageProfile>();

  register(profile: VestaraImageProfile): void {
    if (this.profiles.has(profile.id)) {
      throw conflict(`Image profile "${profile.id}" already registered`);
    }
    this.profiles.set(profile.id, profile);
  }

  get(id: string): VestaraImageProfile {
    const profile = this.profiles.get(id);
    if (!profile) throw notFound(`Image profile "${id}" not found`);
    return profile;
  }

  has(id: string): boolean {
    return this.profiles.has(id);
  }

  list(): readonly VestaraImageProfile[] {
    return [...this.profiles.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Built-in desktop profile. */
  registerDefaults(): void {
    this.profiles.set('vestara-desktop', DESKTOP_PROFILE);
    this.profiles.set('vestara-server', SERVER_PROFILE);
  }
}

export const DESKTOP_PROFILE: VestaraImageProfile = {
  id: 'vestara-desktop',
  version: '0.1.0',
  architecture: 'amd64',
  base: { distribution: 'debian', release: 'trixie', kernel: 'default' },
  boot: { grub: { enabled: true, timeout: 3, theme: 'vestara-dark' }, plymouth: { enabled: true, theme: 'vestara' }, firmwareLogo: { mode: 'runtime-if-supported' } },
  system: { abSlots: true, recovery: true },
  applications: { applications: ['@vestara/app-startup', '@vestara/app-login', '@vestara/app-onboarding', '@vestara/app-desktop', '@vestara/app-workspace', '@vestara/app-marketplace', '@vestara/app-system-settings'] },
  onboarding: { firstBoot: true },
  login: { provider: 'vestara', password: true, fingerprint: 'auto', fido2: 'auto' },
  desktop: { session: 'vestara', startupApp: '@vestara/app-startup', desktopApp: '@vestara/app-desktop' },
  packages: { extraPackages: [] },
  security: { noDefaultOwner: true, sanitizeSecrets: true },
  recovery: { enabled: true, includes: ['startup', 'diagnostics', 'recovery'] },
  profileHash: '',
};

export const SERVER_PROFILE: VestaraImageProfile = {
  id: 'vestara-server',
  version: '0.1.0',
  architecture: 'amd64',
  base: { distribution: 'debian', release: 'trixie', kernel: 'default' },
  boot: { grub: { enabled: true, timeout: 3, theme: 'vestara-dark' }, plymouth: { enabled: false, theme: 'vestara' }, firmwareLogo: { mode: 'none' } },
  system: { abSlots: true, recovery: true },
  applications: { applications: ['@vestara/app-onboarding', '@vestara/app-diagnostics', '@vestara/app-management'] },
  onboarding: { firstBoot: true },
  login: { provider: 'vestara', password: true, fingerprint: 'disabled', fido2: 'disabled' },
  desktop: { session: 'fallback', startupApp: '', desktopApp: '' },
  packages: { extraPackages: [] },
  security: { noDefaultOwner: true, sanitizeSecrets: true },
  recovery: { enabled: true, includes: ['startup', 'diagnostics'] },
  profileHash: '',
};
