export type DetectionStatus = 'supported' | 'unsupported' | 'unknown';

export type FirmwareMode = 'uefi' | 'bios' | 'unknown';

export interface CpuInfo {
  readonly logicalCores: number;
  readonly physicalCores?: number;
  readonly model?: string;
}

export interface MemoryInfo {
  readonly totalBytes: number;
  readonly availableBytes?: number;
}

export interface StorageInfo {
  readonly totalBytes: number;
  readonly devices: readonly { readonly name: string; readonly sizeBytes: number }[];
}

export interface NetworkInfo {
  readonly interfaces: readonly { readonly name: string; readonly up: boolean; readonly mac?: string }[];
}

export interface HardwareDiscovery {
  readonly cpu: CpuInfo;
  readonly memory: MemoryInfo;
  readonly storage: StorageInfo;
  readonly network: NetworkInfo;
}

export interface FirmwareInfo {
  readonly mode: FirmwareMode;
  readonly vendor?: string;
  readonly version?: string;
  readonly secureBoot: { readonly status: DetectionStatus; readonly enabled?: boolean };
  readonly tpm: { readonly status: DetectionStatus; readonly version?: string };
  readonly uefiVariables: { readonly status: DetectionStatus; readonly accessible?: boolean };
}

export interface SystemDiscoveryResult {
  readonly firmware: FirmwareInfo;
  readonly hardware: HardwareDiscovery;
  readonly bootloader: { readonly detected: DetectionStatus; readonly type?: string };
  readonly detectedAt: string;
}
