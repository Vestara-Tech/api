/** IMG-034 — Partition designer. Visual disk layout with validation. */

export type PartitionTableType = 'gpt' | 'mbr';

export type PartitionKind =
  | 'efi'
  | 'bios-boot'
  | 'root'
  | 'ab-slot-a'
  | 'ab-slot-b'
  | 'recovery'
  | 'swap'
  | 'data'
  | 'boot';

export type PartitionFilesystem = 'fat32' | 'ext4' | 'xfs' | 'btrfs' | 'swap';

export type PartitionEncryption = 'none' | 'luks';

export interface PartitionDefinition {
  readonly name: string;
  readonly kind: PartitionKind;
  readonly sizeBytes: number;
  readonly filesystem: PartitionFilesystem;
  readonly encryption?: PartitionEncryption;
  readonly mountPoint?: string;
  readonly label?: string;
  readonly flags?: readonly string[];
}

export interface PartitionLayout {
  readonly tableType: PartitionTableType;
  readonly diskSizeBytes: number;
  readonly partitions: readonly PartitionDefinition[];
}

export interface PartitionLayoutIssue {
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface PartitionLayoutValidation {
  readonly ok: boolean;
  readonly issues: readonly PartitionLayoutIssue[];
}

const ALIGNMENT_BYTES = 1024 * 1024; // 1 MiB
const EFI_MIN_BYTES = 32 * 1024 * 1024; // 32 MiB

/**
 * IMG-034 — Validate a partition layout before build. Catches impossible
 * layouts: total exceeding disk, missing EFI on UEFI, A/B slots without a
 * root, swap without fs, etc.
 */
export function validatePartitionLayout(layout: PartitionLayout): PartitionLayoutValidation {
  const issues: PartitionLayoutIssue[] = [];
  const total = layout.partitions.reduce((sum, p) => sum + p.sizeBytes, 0);

  if (total > layout.diskSizeBytes) {
    issues.push({ message: `Partitions total ${total} bytes exceeds disk size ${layout.diskSizeBytes}`, severity: 'error' });
  }

  if (layout.tableType === 'gpt') {
    const efi = layout.partitions.filter((p) => p.kind === 'efi');
    if (efi.length === 0) issues.push({ message: 'UEFI (GPT) layout requires an EFI system partition', severity: 'error' });
    if (efi.length > 1) issues.push({ message: 'Multiple EFI system partitions are not supported', severity: 'error' });
    for (const p of efi) {
      if (p.filesystem !== 'fat32') issues.push({ message: `EFI partition "${p.name}" must be fat32`, severity: 'error' });
      if (p.sizeBytes < EFI_MIN_BYTES) issues.push({ message: `EFI partition "${p.name}" smaller than ${EFI_MIN_BYTES} bytes`, severity: 'warning' });
    }
  }

  if (layout.tableType === 'mbr') {
    const bios = layout.partitions.filter((p) => p.kind === 'bios-boot');
    if (bios.length === 0) issues.push({ message: 'MBR layout requires a BIOS boot partition', severity: 'error' });
  }

  const abSlots = layout.partitions.filter((p) => p.kind === 'ab-slot-a' || p.kind === 'ab-slot-b');
  const hasRoot = layout.partitions.some((p) => p.kind === 'root');
  const hasAbRoot = abSlots.length > 0;
  if (abSlots.length > 0 && !hasRoot && !hasAbRoot) {
    issues.push({ message: 'A/B slots require a root partition', severity: 'error' });
  }
  if (abSlots.length === 1) {
    issues.push({ message: 'A/B slots must come in pairs (A and B)', severity: 'error' });
  }

  for (const p of layout.partitions) {
    if (p.encryption === 'luks' && p.filesystem === 'swap') {
      issues.push({ message: `Encrypted swap partition "${p.name}" is not supported`, severity: 'warning' });
    }
    if (p.sizeBytes % ALIGNMENT_BYTES !== 0) {
      issues.push({ message: `Partition "${p.name}" size is not 1 MiB aligned`, severity: 'warning' });
    }
    if (p.kind === 'swap' && p.filesystem !== 'swap') {
      issues.push({ message: `Swap partition "${p.name}" must use the swap filesystem`, severity: 'error' });
    }
  }

  return { ok: issues.every((i) => i.severity !== 'error'), issues };
}

/** Example layout used by the desktop profile: EFI + Recovery + A + B + Data. */
export function defaultDesktopLayout(diskSizeBytes = 1024 * 1024 * 1024 * 1024): PartitionLayout {
  return {
    tableType: 'gpt',
    diskSizeBytes,
    partitions: [
      { name: 'EFI', kind: 'efi', sizeBytes: 1024 * 1024 * 1024, filesystem: 'fat32', mountPoint: '/boot/efi', label: 'VESTARA-EFI' },
      { name: 'Recovery', kind: 'recovery', sizeBytes: 16 * 1024 * 1024 * 1024, filesystem: 'ext4', mountPoint: '/recovery', label: 'VESTARA-REC' },
      { name: 'Vestara A', kind: 'ab-slot-a', sizeBytes: 64 * 1024 * 1024 * 1024, filesystem: 'ext4', mountPoint: '/', label: 'VESTARA-A' },
      { name: 'Vestara B', kind: 'ab-slot-b', sizeBytes: 64 * 1024 * 1024 * 1024, filesystem: 'ext4', mountPoint: '/', label: 'VESTARA-B' },
      { name: 'User Data', kind: 'data', sizeBytes: diskSizeBytes - (1024 + 16 + 64 + 64) * 1024 * 1024 * 1024, filesystem: 'btrfs', mountPoint: '/data', label: 'VESTARA-DATA', encryption: 'luks' },
    ],
  };
}
