/** IMG-033 — Hardware targets. Separate image intent from hardware target. */

export type FirmwareKind = 'uefi' | 'bios';
export type TpmMode = 'required' | 'optional' | 'absent';

export interface HardwareDeviceSpec {
  readonly name: string;
  readonly optional?: boolean;
}

export interface HardwareTarget {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly architecture: 'amd64' | 'arm64';
  readonly firmware: FirmwareKind;
  readonly secureBoot: boolean;
  readonly tpm: TpmMode;
  readonly gpu?: readonly string[];
  readonly wifi?: readonly string[];
  readonly bluetooth?: boolean;
  readonly storage: readonly HardwareDeviceSpec[];
  readonly display?: readonly string[];
  readonly drivers: readonly string[];
  readonly kernelModules: readonly string[];
  readonly firmwarePackages: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Catalog of supported hardware targets. */
export function hardwareTargetCatalog(): readonly HardwareTarget[] {
  return [
    {
      id: 'generic-x86_64',
      name: 'Generic x86_64',
      description: 'Generic UEFI/BIOS PC',
      architecture: 'amd64',
      firmware: 'uefi',
      secureBoot: true,
      tpm: 'optional',
      storage: [{ name: 'SATA/NVMe' }],
      drivers: ['ahci', 'nvme', 'e1000', 'virtio'],
      kernelModules: ['usb-storage', 'xhci-pci'],
      firmwarePackages: [],
      metadata: {},
    },
    {
      id: 'generic-arm64',
      name: 'Generic ARM64',
      description: 'Generic ARM64 (QEMU/ACPI)',
      architecture: 'arm64',
      firmware: 'uefi',
      secureBoot: false,
      tpm: 'optional',
      storage: [{ name: 'VirtIO/SD' }],
      drivers: ['virtio-blk', 'dw_mmc', 'arm_smccc'],
      kernelModules: ['usb-storage'],
      firmwarePackages: ['arm-trusted-firmware'],
      metadata: {},
    },
    {
      id: 'virtual-machine',
      name: 'Virtual Machine',
      description: 'QEMU/KVM virtual machine (OVMF)',
      architecture: 'amd64',
      firmware: 'uefi',
      secureBoot: false,
      tpm: 'optional',
      storage: [{ name: 'virtio-blk' }],
      gpu: ['virtio-gpu'],
      drivers: ['virtio', 'virtio-gpu', 'virtio-net'],
      kernelModules: ['virtio-pci'],
      firmwarePackages: ['ovmf'],
      metadata: {},
    },
    {
      id: 'raspberry-pi-4',
      name: 'Raspberry Pi 4',
      description: 'Raspberry Pi 4 Model B',
      architecture: 'arm64',
      firmware: 'bios',
      secureBoot: false,
      tpm: 'absent',
      storage: [{ name: 'microSD' }],
      gpu: ['bcm2711-vc5'],
      wifi: ['brcmfmac'],
      bluetooth: true,
      display: ['HDMI', 'DSI'],
      drivers: ['bcm2711', 'brcmfmac', 'vc4'],
      kernelModules: ['bcm2711-thermal', 'bcm2835-mfd'],
      firmwarePackages: ['raspberrypi-firmware'],
      metadata: {},
    },
    {
      id: 'server-standard',
      name: 'Server (standard)',
      description: 'Generic rack server',
      architecture: 'amd64',
      firmware: 'uefi',
      secureBoot: true,
      tpm: 'required',
      storage: [{ name: 'SAS/SATA' }, { name: 'NVMe' }],
      drivers: ['ahci', 'megaraid_sas', 'nvme', 'igb', 'ixgbe'],
      kernelModules: ['ipmi_si', 'ipmi_msghandler'],
      firmwarePackages: [],
      metadata: {},
    },
    {
      id: 'custom',
      name: 'Custom',
      description: 'User-defined hardware target',
      architecture: 'amd64',
      firmware: 'uefi',
      secureBoot: true,
      tpm: 'optional',
      storage: [],
      drivers: [],
      kernelModules: [],
      firmwarePackages: [],
      metadata: {},
    },
  ];
}

export function resolveHardwareTarget(id: string): HardwareTarget {
  const target = hardwareTargetCatalog().find((t) => t.id === id);
  if (!target) throw new Error(`Unknown hardware target "${id}"`);
  return target;
}
