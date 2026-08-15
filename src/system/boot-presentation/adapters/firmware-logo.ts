import type { BootAsset } from '../domain/asset.js';

export type FirmwareLogoMechanism = 'uefi-capsule' | 'vendor-tool' | 'firmware-setting' | 'unsupported';

export interface FirmwareLogoCapabilities {
  readonly readable: boolean;
  readonly writable: boolean;
  readonly replaceable: boolean;
  readonly restoreSupported: boolean;
  readonly requiresReboot: boolean;
  readonly mechanism: FirmwareLogoMechanism;
  readonly vendor?: string;
  readonly reason?: string;
}

export interface FirmwareLogoBackup {
  readonly id: string;
  readonly capturedAt: string;
}

/**
 * SYS-022/023 — Firmware-logo adapter contract.
 *
 * Completely separate from Plymouth/GRUB. Firmware-logo replacement is
 * CRITICAL risk: it requires UEFI, a supported vendor/platform adapter, an
 * available backup, and explicit special-policy approval. On unsupported
 * hardware it reports `unsupported` — never falling back to generic flashing.
 */
export interface FirmwareLogoAdapter {
  readonly vendor: string;
  discover(): Promise<FirmwareLogoCapabilities>;
  validateAsset(asset: BootAsset): Promise<{ ok: boolean; reason?: string }>;
  backup(): Promise<FirmwareLogoBackup | null>;
  plan(asset: BootAsset): Promise<{ willReplace: boolean; requiresReboot: boolean }>;
  apply(asset: BootAsset): Promise<{ ok: boolean; message?: string }>;
  verify(): Promise<{ ok: boolean; message?: string }>;
  restore(backupId?: string): Promise<{ ok: boolean; message?: string }>;
}

/** Always-unsupported adapter — the safe default when no vendor adapter exists. */
export class UnsupportedFirmwareLogoAdapter implements FirmwareLogoAdapter {
  readonly vendor = 'unsupported';
  async discover(): Promise<FirmwareLogoCapabilities> {
    return {
      readable: false,
      writable: false,
      replaceable: false,
      restoreSupported: false,
      requiresReboot: false,
      mechanism: 'unsupported',
      reason: 'Firmware does not expose a supported logo interface',
    };
  }
  async validateAsset(): Promise<{ ok: boolean; reason?: string }> {
    return { ok: false, reason: 'unsupported' };
  }
  async backup(): Promise<FirmwareLogoBackup | null> {
    return null;
  }
  async plan(): Promise<{ willReplace: boolean; requiresReboot: boolean }> {
    return { willReplace: false, requiresReboot: false };
  }
  async apply(): Promise<{ ok: boolean; message?: string }> {
    return { ok: false, message: 'firmware logo replacement unsupported' };
  }
  async verify(): Promise<{ ok: boolean; message?: string }> {
    return { ok: false, message: 'unsupported' };
  }
  async restore(): Promise<{ ok: boolean; message?: string }> {
    return { ok: false, message: 'unsupported' };
  }
}

export function requiresSpecialPolicy(capabilities: FirmwareLogoCapabilities): boolean {
  return capabilities.replaceable === true;
}
