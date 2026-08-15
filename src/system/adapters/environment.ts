import { cpus, hostname, networkInterfaces, totalmem } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import type { SystemDiscoveryPort } from '../discovery/port.js';
import type { BootEntry } from '../domain/boot.js';
import type { SlotState } from '../domain/slots.js';
import type { FirmwareMode, SystemDiscoveryResult } from '../discovery/types.js';

/**
 * Environment-based system discovery adapter.
 *
 * Detects what it can from the host OS; degrades gracefully to
 * `unsupported`/`unknown` where privileged info (efivars, firmware, TPM) is not
 * accessible. This is the honest baseline — a privileged `vestara-system`
 * service would provide the same contract with real reads.
 */
export class EnvironmentSystemDiscovery implements SystemDiscoveryPort {
  async discover(): Promise<SystemDiscoveryResult> {
    const mode = await this.detectFirmwareMode();
    const uefiAccessible = mode === 'uefi' && existsSync('/sys/firmware/efi/efivars');
    return {
      firmware: {
        mode,
        secureBoot: { status: uefiAccessible ? 'unknown' : 'unsupported' },
        tpm: { status: this.tpmPresent() ? 'supported' : 'unsupported' },
        uefiVariables: { status: uefiAccessible ? 'supported' : 'unsupported', accessible: uefiAccessible },
      },
      hardware: {
        cpu: { logicalCores: cpus().length },
        memory: { totalBytes: totalmem() },
        storage: { totalBytes: 0, devices: [] },
        network: {
          interfaces: Object.entries(networkInterfaces())
            .flatMap(([name, addrs]) => (addrs ?? []).map((a) => ({ name, up: true, mac: a.mac })))
            .filter((i) => i.mac && i.mac !== '00:00:00:00:00:00'),
        },
      },
      bootloader: { detected: existsSync('/boot/grub') ? 'supported' : 'unknown', type: 'grub' },
      detectedAt: new Date().toISOString(),
    };
  }

  async bootEntries(): Promise<readonly BootEntry[]> {
    return [{ id: 'current', label: hostname(), source: 'unknown', active: true, isVestara: true }];
  }

  async slotState(): Promise<SlotState | null> {
    return null; // no slot infrastructure detected
  }

  private async detectFirmwareMode(): Promise<FirmwareMode> {
    try {
      if (existsSync('/sys/firmware/efi')) return 'uefi';
    } catch {
      /* fall through */
    }
    return 'unknown';
  }

  private tpmPresent(): boolean {
    try {
      return existsSync('/sys/class/tpm') || existsSync('/dev/tpm0') || readFileSafe('/sys/class/tpm/tpm0/tpm_version_major') !== null;
    } catch {
      return false;
    }
  }
}

function readFileSafe(p: string): string | null {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}
