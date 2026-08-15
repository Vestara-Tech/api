import type {
  Architecture,
  ImageProfile,
  UpdateImageProfileInput,
} from '../api/contracts';

export type { ImageProfile, UpdateImageProfileInput };

export interface AppCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly category: 'core' | 'vestara' | 'optional';
  readonly sizeMb: number;
  readonly required: boolean;
  readonly note?: string;
}

export const APP_CATALOG: readonly AppCatalogEntry[] = [
  { id: '@vestara/app-startup', name: 'Startup', category: 'core', sizeMb: 8, required: true, note: 'Required' },
  { id: '@vestara/app-login', name: 'Login', category: 'core', sizeMb: 12, required: true, note: 'Required' },
  { id: '@vestara/app-onboarding', name: 'Onboarding', category: 'core', sizeMb: 9, required: true, note: 'First boot' },
  { id: '@vestara/app-desktop', name: 'Desktop', category: 'core', sizeMb: 64, required: true, note: 'Required' },
  { id: '@vestara/app-workspace', name: 'Workspace', category: 'vestara', sizeMb: 148, required: false },
  { id: '@vestara/app-marketplace', name: 'Marketplace', category: 'vestara', sizeMb: 32, required: false },
  { id: '@vestara/app-system-settings', name: 'System Settings', category: 'vestara', sizeMb: 21, required: false },
  { id: '@vestara/app-diagnostics', name: 'Diagnostics', category: 'vestara', sizeMb: 18, required: false },
  { id: '@vestara/app-api-builder', name: 'API Builder', category: 'vestara', sizeMb: 47, required: false },
  { id: '@vestara/app-management', name: 'Management', category: 'vestara', sizeMb: 26, required: false },
  { id: '@vestara/app-database-builder', name: 'Database Builder', category: 'optional', sizeMb: 39, required: false },
  { id: '@vestara/app-generator-studio', name: 'Generator Studio', category: 'optional', sizeMb: 31, required: false },
];

export function catalogEntry(id: string): AppCatalogEntry | undefined {
  return APP_CATALOG.find((a) => a.id === id);
}

export const GRUB_THEMES = ['vestara-dark', 'vestara-light', 'minimal'] as const;
export const PLYMOUTH_THEMES = ['vestara', 'fade-in', 'spinfinity'] as const;

export const IMAGE_TARGETS = [
  { value: 'raw', label: 'Raw Image' },
  { value: 'installer', label: 'ISO' },
  { value: 'virtual', label: 'QCOW2' },
] as const;

export type ImageBuildTarget = (typeof IMAGE_TARGETS)[number]['value'];

export interface ImagePreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly base: Omit<UpdateImageProfileInput, never> & { readonly id: string };
}

export const PRESETS: readonly ImagePreset[] = [
  {
    id: 'vestara-desktop',
    name: 'Vestara Desktop',
    description: 'Workstation with the Vestara Desktop session and core apps.',
    base: {
      id: 'vestara-desktop',
      version: '0.1.0',
      architecture: 'amd64' as Architecture,
      base: { distribution: 'debian', release: 'trixie', kernel: 'default' },
      boot: {
        grub: { enabled: true, timeout: 3, theme: 'vestara-dark' },
        plymouth: { enabled: true, theme: 'vestara' },
        firmwareLogo: { mode: 'runtime-if-supported' },
      },
      system: { abSlots: true, recovery: true },
      applications: { applications: ['@vestara/app-startup', '@vestara/app-login', '@vestara/app-onboarding', '@vestara/app-desktop', '@vestara/app-workspace', '@vestara/app-marketplace', '@vestara/app-system-settings'] },
      onboarding: { firstBoot: true },
      login: { provider: 'vestara', password: true, fingerprint: 'auto', fido2: 'auto' },
      desktop: { session: 'vestara', startupApp: '@vestara/app-startup', desktopApp: '@vestara/app-desktop' },
      packages: { extraPackages: [] },
      security: { noDefaultOwner: true, sanitizeSecrets: true },
      recovery: { enabled: true, includes: ['startup', 'diagnostics', 'recovery'] },
    },
  },
  {
    id: 'vestara-developer',
    name: 'Vestara Developer',
    description: 'Desktop plus API Builder, Database Builder and Generator Studio.',
    base: {
      id: 'vestara-developer',
      version: '0.1.0',
      architecture: 'amd64' as Architecture,
      base: { distribution: 'debian', release: 'trixie', kernel: 'default' },
      boot: {
        grub: { enabled: true, timeout: 3, theme: 'vestara-dark' },
        plymouth: { enabled: true, theme: 'vestara' },
        firmwareLogo: { mode: 'runtime-if-supported' },
      },
      system: { abSlots: true, recovery: true },
      applications: { applications: ['@vestara/app-startup', '@vestara/app-login', '@vestara/app-onboarding', '@vestara/app-desktop', '@vestara/app-workspace', '@vestara/app-api-builder', '@vestara/app-database-builder', '@vestara/app-generator-studio', '@vestara/app-system-settings'] },
      onboarding: { firstBoot: true },
      login: { provider: 'vestara', password: true, fingerprint: 'auto', fido2: 'auto' },
      desktop: { session: 'vestara', startupApp: '@vestara/app-startup', desktopApp: '@vestara/app-desktop' },
      packages: { extraPackages: ['git', 'build-essential', 'curl'] },
      security: { noDefaultOwner: true, sanitizeSecrets: true },
      recovery: { enabled: true, includes: ['startup', 'diagnostics', 'recovery'] },
    },
  },
  {
    id: 'vestara-server',
    name: 'Vestara Server',
    description: 'Headless server with management and diagnostics only.',
    base: {
      id: 'vestara-server',
      version: '0.1.0',
      architecture: 'amd64' as Architecture,
      base: { distribution: 'debian', release: 'trixie', kernel: 'default' },
      boot: {
        grub: { enabled: true, timeout: 3, theme: 'vestara-dark' },
        plymouth: { enabled: false, theme: 'vestara' },
        firmwareLogo: { mode: 'none' },
      },
      system: { abSlots: true, recovery: true },
      applications: { applications: ['@vestara/app-onboarding', '@vestara/app-diagnostics', '@vestara/app-management'] },
      onboarding: { firstBoot: true },
      login: { provider: 'vestara', password: true, fingerprint: 'disabled', fido2: 'disabled' },
      desktop: { session: 'fallback', startupApp: '', desktopApp: '' },
      packages: { extraPackages: [] },
      security: { noDefaultOwner: true, sanitizeSecrets: true },
      recovery: { enabled: true, includes: ['startup', 'diagnostics'] },
    },
  },
  {
    id: 'vestara-recovery',
    name: 'Vestara Recovery',
    description: 'Minimal recovery environment for diagnostics and repair.',
    base: {
      id: 'vestara-recovery',
      version: '0.1.0',
      architecture: 'amd64' as Architecture,
      base: { distribution: 'debian', release: 'trixie', kernel: 'default' },
      boot: {
        grub: { enabled: true, timeout: 1, theme: 'minimal' },
        plymouth: { enabled: false, theme: 'vestara' },
        firmwareLogo: { mode: 'none' },
      },
      system: { abSlots: false, recovery: true },
      applications: { applications: ['@vestara/app-diagnostics'] },
      onboarding: { firstBoot: false },
      login: { provider: 'vestara', password: true, fingerprint: 'disabled', fido2: 'disabled' },
      desktop: { session: 'fallback', startupApp: '', desktopApp: '' },
      packages: { extraPackages: [] },
      security: { noDefaultOwner: true, sanitizeSecrets: true },
      recovery: { enabled: true, includes: ['startup', 'diagnostics', 'recovery'] },
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Start blank and build your own image profile.',
    base: {
      id: 'custom',
      version: '0.1.0',
      architecture: 'amd64' as Architecture,
      base: { distribution: 'debian', release: 'trixie', kernel: 'default' },
      boot: {
        grub: { enabled: true, timeout: 3, theme: 'vestara-dark' },
        plymouth: { enabled: true, theme: 'vestara' },
        firmwareLogo: { mode: 'runtime-if-supported' },
      },
      system: { abSlots: true, recovery: true },
      applications: { applications: [] },
      onboarding: { firstBoot: true },
      login: { provider: 'vestara', password: true, fingerprint: 'auto', fido2: 'auto' },
      desktop: { session: 'fallback', startupApp: '', desktopApp: '' },
      packages: { extraPackages: [] },
      security: { noDefaultOwner: true, sanitizeSecrets: true },
      recovery: { enabled: true, includes: ['startup', 'diagnostics'] },
    },
  },
];

export function presetFor(id: string): ImagePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function applicationsSizeMb(apps: readonly string[]): number {
  return apps.reduce((sum, id) => sum + (catalogEntry(id)?.sizeMb ?? 0), 0);
}
