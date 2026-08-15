/** SYS-026..035 — Normalized system inventory (SystemSnapshot). */

export type DetectionStatus = 'supported' | 'unsupported' | 'unknown';

export interface SystemIdentity {
  readonly hostname: string;
  readonly machineId?: string;
  readonly productName?: string;
  readonly vendor?: string;
}

export interface OperatingSystemInfo {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly versionId?: string;
  readonly kernel: string;
  readonly architecture: string;
  readonly bootMode: 'uefi' | 'bios' | 'unknown';
  readonly detectedAt: string;
}

export interface CpuSubsystem {
  readonly logicalCores: number;
  readonly physicalCores?: number;
  readonly sockets?: number;
  readonly model?: string;
  readonly vendor?: string;
  readonly frequencyMhz?: number;
  readonly loadAverage1?: number;
  readonly status: DetectionStatus;
}

export interface MemorySubsystem {
  readonly totalBytes: number;
  readonly availableBytes?: number;
  readonly usedBytes?: number;
  readonly swapTotalBytes?: number;
  readonly swapUsedBytes?: number;
  readonly status: DetectionStatus;
}

export interface StorageDeviceInfo {
  readonly name: string;
  readonly sizeBytes: number;
  readonly type?: 'nvme' | 'sata' | 'sas' | 'usb' | 'mmc' | 'virtio' | 'unknown';
  readonly model?: string;
  readonly removable?: boolean;
  readonly healthy?: boolean;
}

export interface StorageSubsystem {
  readonly devices: readonly StorageDeviceInfo[];
  readonly totalBytes: number;
  readonly status: DetectionStatus;
}

export interface FilesystemInfo {
  readonly device: string;
  readonly mountPoint: string;
  readonly filesystem: string;
  readonly totalBytes?: number;
  readonly usedBytes?: number;
  readonly availableBytes?: number;
  readonly options?: string;
  readonly mounted: boolean;
}

export interface FilesystemSubsystem {
  readonly filesystems: readonly FilesystemInfo[];
  readonly status: DetectionStatus;
}

export interface NetworkInterfaceInfo {
  readonly name: string;
  readonly up: boolean;
  readonly mac?: string;
  readonly ipv4?: readonly string[];
  readonly ipv6?: readonly string[];
  readonly type?: 'ethernet' | 'wifi' | 'loopback' | 'bridge' | 'virtual' | 'unknown';
  readonly speedMbps?: number;
}

export interface NetworkSubsystem {
  readonly interfaces: readonly NetworkInterfaceInfo[];
  readonly status: DetectionStatus;
}

export interface GraphicsDeviceInfo {
  readonly name: string;
  readonly vendor?: string;
  readonly pci?: string;
  readonly driver?: string;
  readonly resolution?: string;
  readonly status: DetectionStatus;
}

export interface GraphicsSubsystem {
  readonly devices: readonly GraphicsDeviceInfo[];
  readonly status: DetectionStatus;
}

export interface HardwareDeviceInfo {
  readonly name: string;
  readonly bus?: 'pci' | 'usb' | 'virtio' | 'sdio' | 'platform' | 'unknown';
  readonly vendor?: string;
  readonly id?: string;
  readonly class?: string;
  readonly driver?: string;
}

export interface DeviceSubsystem {
  readonly devices: readonly HardwareDeviceInfo[];
  readonly status: DetectionStatus;
}

export interface PowerInfo {
  readonly onBattery?: boolean;
  readonly batteryPercent?: number;
  readonly acPowered?: boolean;
  readonly status: DetectionStatus;
}

export interface PowerSubsystem {
  readonly info: PowerInfo;
  readonly status: DetectionStatus;
}

export interface ThermalInfo {
  readonly currentCelsius?: number;
  readonly criticalCelsius?: number;
  readonly sensors?: readonly { name: string; currentCelsius?: number }[];
  readonly status: DetectionStatus;
}

export interface ThermalSubsystem {
  readonly info: ThermalInfo;
  readonly status: DetectionStatus;
}

export interface KernelSubsystem {
  readonly release: string;
  readonly version?: string;
  readonly modules: readonly { name: string; size?: number; usedBy?: readonly string[] }[];
  readonly parameters?: readonly { name: string; value?: string }[];
  readonly status: DetectionStatus;
}

export interface BootState {
  readonly entries: readonly { id: string; label: string; active: boolean; isVestara: boolean }[];
  readonly slot?: { active: string; other: string; booted: string };
  readonly nextBoot?: string;
  readonly status: DetectionStatus;
}

/** SYS-026 — One normalized snapshot consumed by all Vestara modules. */
export interface SystemSnapshot {
  readonly identity: SystemIdentity;
  readonly operatingSystem: OperatingSystemInfo;
  readonly firmware: { mode: string; secureBoot?: { enabled?: boolean; status: DetectionStatus }; tpm?: { version?: string; status: DetectionStatus } };
  readonly cpu: CpuSubsystem;
  readonly memory: MemorySubsystem;
  readonly storage: StorageSubsystem;
  readonly filesystems: FilesystemSubsystem;
  readonly network: NetworkSubsystem;
  readonly graphics: GraphicsSubsystem;
  readonly devices: DeviceSubsystem;
  readonly power: PowerSubsystem;
  readonly thermal: ThermalSubsystem;
  readonly kernel: KernelSubsystem;
  readonly boot: BootState;
  readonly capturedAt: string;
}

/** SYS-027..035 — Snapshot sections. Adapters fill supported parts; missing parts are reported honestly. */
export interface SystemInventoryPort {
  capture(): Promise<SystemSnapshot>;
}

export interface SystemInventorySection {
  readonly name: keyof Omit<SystemSnapshot, 'capturedAt'>;
  readonly status: DetectionStatus;
}

export function inventorySections(snapshot: SystemSnapshot): readonly SystemInventorySection[] {
  const entries: SystemInventorySection[] = [];
  const sections: (keyof Omit<SystemSnapshot, 'capturedAt'>)[] = [
    'identity', 'operatingSystem', 'firmware', 'cpu', 'memory', 'storage', 'filesystems',
    'network', 'graphics', 'devices', 'power', 'thermal', 'kernel', 'boot',
  ];
  for (const section of sections) {
    const value = snapshot[section] as Record<string, unknown>;
    const status = (value?.status as DetectionStatus | undefined) ?? (value ? 'supported' : 'unknown');
    entries.push({ name: section, status });
  }
  return entries;
}
