import { hashOf } from '../../generator/domain/hash.js';

export type ImageArchitecture = 'amd64' | 'arm64';

export interface BaseSystemProfile {
  readonly distribution: 'debian';
  readonly release: string;
  readonly kernel: 'default' | string;
}

export interface BootProfile {
  readonly grub: { readonly enabled: boolean; readonly timeout: number; readonly theme?: string };
  readonly plymouth: { readonly enabled: boolean; readonly theme: string };
  readonly firmwareLogo: { readonly mode: 'runtime-if-supported' | 'none' };
}

export interface SystemProfile {
  readonly abSlots: boolean;
  readonly recovery: boolean;
}

export interface LoginProfile {
  readonly provider: 'vestara';
  readonly password: boolean;
  readonly fingerprint: 'auto' | 'disabled';
  readonly fido2: 'auto' | 'disabled';
}

export interface OnboardingProfile {
  readonly firstBoot: boolean;
}

export interface DesktopProfile {
  readonly session: 'vestara' | 'fallback';
  readonly startupApp: string;
  readonly desktopApp: string;
}

export interface PackageProfile {
  readonly extraPackages: readonly string[];
}

export interface SecurityProfile {
  readonly noDefaultOwner: boolean;
  readonly sanitizeSecrets: boolean;
}

export interface RecoveryProfile {
  readonly enabled: boolean;
  readonly includes: readonly string[];
}

export interface ApplicationProfile {
  readonly applications: readonly string[];
}

export interface VestaraImageProfile {
  readonly id: string;
  readonly version: string;
  readonly architecture: ImageArchitecture;
  readonly base: BaseSystemProfile;
  readonly boot: BootProfile;
  readonly system: SystemProfile;
  readonly applications: ApplicationProfile;
  readonly onboarding: OnboardingProfile;
  readonly login: LoginProfile;
  readonly desktop: DesktopProfile;
  readonly packages: PackageProfile;
  readonly security: SecurityProfile;
  readonly recovery: RecoveryProfile;
  readonly profileHash: string;
}

export type ImageBuildTarget = 'raw' | 'installer' | 'virtual';

export function hashImageProfile(profile: Omit<VestaraImageProfile, 'profileHash'>): string {
  return hashOf({
    id: profile.id,
    version: profile.version,
    architecture: profile.architecture,
    base: profile.base,
    boot: profile.boot,
    system: profile.system,
    applications: profile.applications,
    onboarding: profile.onboarding,
    login: profile.login,
    desktop: profile.desktop,
    packages: profile.packages,
    security: profile.security,
    recovery: profile.recovery,
  });
}

export function withProfileHash(profile: Omit<VestaraImageProfile, 'profileHash'>): VestaraImageProfile {
  return { ...profile, profileHash: hashImageProfile(profile) };
}
