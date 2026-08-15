/** OS-001/004 — OS domain contracts and the canonical OsProfile. */

export type OsDistributionId = 'debian' | 'ubuntu' | 'fedora' | 'arch' | 'generic-linux' | 'unknown';

export type OsPackageManagerKind = 'apt' | 'dnf' | 'pacman' | 'generic';

export interface OsIdentity {
  readonly machineId?: string;
  readonly hostname: string;
  readonly osId: string;
  readonly osName: string;
  readonly osVersion: string;
  readonly osPrettyName?: string;
  readonly kernelRelease: string;
  readonly architecture: string;
  readonly distributionId: OsDistributionId;
  readonly distributionVersion?: string;
  readonly packageManager: OsPackageManagerKind;
}

export interface DistributionProfile {
  readonly id: OsDistributionId;
  readonly version?: string;
  readonly codename?: string;
  readonly repositories: readonly string[];
  readonly packageManager: OsPackageManagerKind;
  readonly releaseNotes?: string;
}

export interface KernelProfile {
  readonly release: string;
  readonly parameters: readonly string[];
  readonly modules: readonly { name: string; enabled: boolean; options?: string }[];
  readonly initramfs: { readonly enabled: boolean; readonly compression?: string };
  readonly updatePolicy: 'security-only' | 'recommended' | 'all' | 'manual';
  readonly commandLine?: string;
}

export interface PackageProfile {
  readonly packages: readonly { name: string; version?: string; state: 'installed' | 'held' | 'absent'; source?: string }[];
  readonly repositories: readonly { name: string; url: string; enabled: boolean; signedBy?: string }[];
}

export interface ServiceProfile {
  readonly services: readonly { name: string; state: 'enabled' | 'disabled' | 'masked'; loadState: 'loaded' | 'not-found' | 'error' }[];
}

export interface UserAccountProfile {
  readonly username: string;
  readonly uid?: number;
  readonly gid?: number;
  readonly displayName?: string;
  readonly home?: string;
  readonly shell?: string;
  readonly groups: readonly string[];
  readonly autoLogin: boolean;
}

export interface StartupProfile {
  readonly target: string;
  readonly services: readonly string[];
  readonly dependencies: readonly string[];
  readonly timeoutSeconds: number;
  readonly presentation: string;
  readonly failurePolicy: 'continue' | 'recovery' | 'halt';
}

export interface LoginProfile {
  readonly provider: 'vestara' | 'local' | 'oidc' | 'none';
  readonly allowPassword: boolean;
  readonly allowPin: boolean;
  readonly allowPasskey: boolean;
  readonly allowAutoLogin: boolean;
  readonly allowGuest: boolean;
  readonly allowRecovery: boolean;
}

export interface DesktopProfile {
  readonly environment: string;
  readonly theme: string;
  readonly wallpaper: string;
  readonly fonts: readonly string[];
  readonly icons: string;
  readonly cursor: string;
  readonly panels: readonly string[];
  readonly launcher: string;
  readonly workspaceCount: number;
  readonly startupApplications: readonly string[];
  readonly lockScreen: string;
}

export interface NetworkProfile {
  readonly hostname: string;
  readonly interfaces: readonly { name: string; dhcp: boolean; address?: string; gateway?: string; dns?: readonly string[] }[];
}

export interface LocaleProfile {
  readonly language: string;
  readonly locale: string;
  readonly timezone: string;
  readonly keymap: string;
}

export interface SecurityProfile {
  readonly lockdown: 'none' | 'standard' | 'hardened';
  readonly firewalld: boolean;
  readonly selinux: 'disabled' | 'enforcing' | 'permissive';
  readonly unattendedUpgrades: boolean;
  readonly secureBootPolicy: 'disabled' | 'optional' | 'required';
}

export interface UpdateProfile {
  readonly channel: 'stable' | 'beta' | 'development';
  readonly automatic: boolean;
  readonly autoUpgrade: boolean;
  readonly rebootPolicy: 'never' | 'auto' | 'ask';
  readonly rollbackOnBootFailure: boolean;
}

export interface RecoveryProfile {
  readonly enabled: boolean;
  readonly partition: string;
  readonly includes: readonly string[];
  readonly autoRepair: boolean;
}

/**
 * OS-004 — OsProfile. One canonical declarative definition of an operating
 * system. It describes both the CURRENT OS and the DESIRED OS; the diff
 * engine and change planner operate between the two.
 */
export interface OsProfile {
  readonly identity: OsIdentity;
  readonly distribution: DistributionProfile;
  readonly kernel: KernelProfile;
  readonly packages: PackageProfile;
  readonly services: ServiceProfile;
  readonly users: readonly UserAccountProfile[];
  readonly startup: StartupProfile;
  readonly login: LoginProfile;
  readonly desktop: DesktopProfile;
  readonly network: NetworkProfile;
  readonly locale: LocaleProfile;
  readonly security: SecurityProfile;
  readonly updates: UpdateProfile;
  readonly recovery: RecoveryProfile;
}
