export type BootEntrySource = 'uefi' | 'grub' | 'bios' | 'unknown';

export interface BootEntry {
  readonly id: string;
  readonly label: string;
  readonly source: BootEntrySource;
  readonly active: boolean;
  readonly isVestara: boolean;
  readonly bootNumber?: string;
  readonly description?: string;
}

export interface BootOrder {
  readonly entries: readonly BootEntry[];
  readonly nextBootId?: string;
  readonly nextBootSet: boolean;
}

/** SYS-010 — Boot entry model shared by UEFI/GRUB/BIOS adapters. */
export function createBootOrder(entries: readonly BootEntry[], nextBootId?: string): BootOrder {
  return {
    entries,
    ...(nextBootId !== undefined ? { nextBootId } : {}),
    nextBootSet: nextBootId !== undefined,
  };
}
