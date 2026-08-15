import type { BootAsset } from '../domain/asset.js';
import type { GrubPresentation, PlymouthPresentation } from '../domain/profile.js';

export interface AdapterStatus {
  readonly supported: boolean;
  readonly reason?: string;
}

export interface ApplyResult {
  readonly ok: boolean;
  readonly message?: string;
}

/**
 * SYS-018 — Plymouth adapter. The privileged `vestara-system` service performs
 * the actual operation: install assets, install/update theme, select theme,
 * rebuild initramfs, verify. The API never touches these directly.
 */
export interface PlymouthAdapter {
  isAvailable(): Promise<AdapterStatus>;
  installTheme(profile: PlymouthPresentation, assets: ReadonlyMap<string, BootAsset>): Promise<ApplyResult>;
  selectTheme(name: string): Promise<ApplyResult>;
  rebuildInitramfs(): Promise<ApplyResult>;
  verify(): Promise<ApplyResult>;
  backup(): Promise<ApplyResult>;
  restoreBackup(): Promise<ApplyResult>;
}

/**
 * SYS-019 — GRUB presentation adapter. Backs up config, installs theme assets,
 * updates a Vestara-owned drop-in fragment (never arbitrary /etc/default/grub
 * edits), regenerates grub.cfg, verifies.
 */
export interface GrubPresentationAdapter {
  isAvailable(): Promise<AdapterStatus>;
  installTheme(profile: GrubPresentation, assets: ReadonlyMap<string, BootAsset>): Promise<ApplyResult>;
  updateFragment(fragment: string): Promise<ApplyResult>;
  regenerateGrubCfg(): Promise<ApplyResult>;
  verify(): Promise<ApplyResult>;
  backup(): Promise<ApplyResult>;
  restoreBackup(): Promise<ApplyResult>;
}
