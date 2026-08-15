import type { SystemDiscoveryResult } from './types.js';

export interface SystemDiscoveryPort {
  discover(): Promise<SystemDiscoveryResult>;
  bootEntries(): Promise<readonly import('../domain/boot.js').BootEntry[]>;
  slotState(): Promise<import('../domain/slots.js').SlotState | null>;
}
