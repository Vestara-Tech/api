import { cpus, hostname, networkInterfaces, totalmem } from 'node:os';
import { existsSync } from 'node:fs';
import { loadavg } from 'node:os';
import type { SystemInventoryPort, SystemSnapshot } from './domain.js';

/**
 * SYS-027..035 — Environment-based inventory capture. Reads what the host OS
 * exposes safely (CPU, memory, network, OS release); degrades to
 * `unsupported` where privileged info (graphics, TPM, firmware, sensors) is
 * not accessible. A privileged `vestara-systemd` daemon would provide the
 * same contract with real reads.
 */
export class EnvironmentSystemInventory implements SystemInventoryPort {
  async capture(): Promise<SystemSnapshot> {
    const kernel = await this.readOsRelease();
    const bootMode = existsSync('/sys/firmware/efi') ? 'uefi' : 'unknown';
    const tpm = await this.tpmStatus();
    const secureBoot = await this.secureBootStatus();

    const cpuInfo = cpus();
    const load = loadavg();

    return {
      identity: { hostname: hostname() },
      operatingSystem: {
        id: kernel.id,
        name: kernel.name,
        version: kernel.version,
        ...(kernel.versionId !== undefined ? { versionId: kernel.versionId } : {}),
        kernel: process.version ?? 'unknown',
        architecture: process.arch,
        bootMode,
        detectedAt: new Date().toISOString(),
      },
      firmware: {
        mode: bootMode,
        ...(secureBoot !== null ? { secureBoot } : {}),
        ...(tpm !== null ? { tpm } : {}),
      },
      cpu: {
        logicalCores: cpuInfo.length,
        ...(cpuInfo[0]?.model !== undefined ? { model: cpuInfo[0].model } : {}),
        ...(load[0] !== undefined ? { loadAverage1: load[0] } : {}),
        status: 'supported',
      },
      memory: {
        totalBytes: totalmem(),
        status: 'supported',
      },
      storage: {
        devices: [],
        totalBytes: 0,
        status: 'unsupported',
      },
      filesystems: {
        filesystems: [],
        status: 'unsupported',
      },
      network: {
        interfaces: Object.entries(networkInterfaces())
          .flatMap(([name, addrs]) => (addrs ?? []).map((a) => ({ name, up: true, mac: a.mac, ...(a.family === 'IPv4' ? { ipv4: [a.address] } : a.family === 'IPv6' ? { ipv6: [a.address] } : {}) })))
          .filter((i) => i.mac && i.mac !== '00:00:00:00:00:00'),
        status: 'supported',
      },
      graphics: { devices: [], status: 'unsupported' },
      devices: { devices: [], status: 'unsupported' },
      power: { info: { status: 'unsupported' as const }, status: 'unsupported' },
      thermal: { info: { status: 'unsupported' as const }, status: 'unsupported' },
      kernel: {
        release: process.version ?? 'unknown',
        modules: [],
        status: 'supported',
      },
      boot: {
        entries: [],
        status: 'unsupported',
      },
      capturedAt: new Date().toISOString(),
    };
  }

  private async readOsRelease(): Promise<{ id: string; name: string; version: string; versionId?: string }> {
    try {
      const content = await import('node:fs/promises').then((fs) => fs.readFile('/etc/os-release', 'utf8'));
      const parse = (key: string): string | undefined => {
        const match = content.match(new RegExp(`^${key}="?([^"\\n]+)"?`, 'm'));
        return match?.[1];
      };
      const id = parse('ID') ?? 'linux';
      const name = parse('NAME') ?? id;
      const version = parse('VERSION_ID') ?? 'unknown';
      const versionId = parse('VERSION_ID');
      return { id, name, version, ...(versionId !== undefined ? { versionId } : {}) };
    } catch {
      return { id: 'linux', name: 'Linux', version: 'unknown' };
    }
  }

  private async tpmStatus(): Promise<{ version?: string; status: 'supported' | 'unsupported' } | null> {
    if (existsSync('/sys/class/tpm') || existsSync('/dev/tpm0')) {
      return { status: 'supported' };
    }
    return null;
  }

  private async secureBootStatus(): Promise<{ enabled?: boolean; status: 'supported' | 'unsupported' } | null> {
    if (existsSync('/sys/firmware/efi/efivars/SecureBoot-8be4df61-93ca-11d2-aa0d-00e098032b8c')) {
      return { status: 'supported' };
    }
    return null;
  }
}
