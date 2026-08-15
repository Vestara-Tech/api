export type SystemRiskLevel = 'low' | 'high' | 'critical';

export type SystemOperationKind = 'read' | 'write' | 'control';

export interface SystemCapabilityDefinition {
  readonly id: string; // e.g. system.boot.next.write
  readonly kind: SystemOperationKind;
  readonly risk: SystemRiskLevel;
  readonly requiresApproval: boolean;
  readonly description: string;
}

/**
 * SYS-002 — Privilege/capability boundary.
 *
 * The API never touches firmware/hardware directly. It calls narrowly scoped
 * system capabilities. READ ops are low risk; WRITE ops are high risk; firmware
 * modification is CRITICAL and requires explicit approval. Arbitrary root
 * execution is deliberately absent.
 */
export const SYSTEM_CAPABILITIES: readonly SystemCapabilityDefinition[] = [
  // ── Read (low risk) ─────────────────────────────────────────
  { id: 'system.firmware.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read firmware information' },
  { id: 'system.firmware.secureBoot.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read Secure Boot state' },
  { id: 'system.hardware.cpu.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read CPU information' },
  { id: 'system.hardware.memory.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read memory information' },
  { id: 'system.hardware.storage.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read storage information' },
  { id: 'system.hardware.network.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read network information' },
  { id: 'system.tpm.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read TPM state' },
  { id: 'system.boot.entries.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read boot entries' },
  { id: 'system.boot.next.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read next-boot target' },
  { id: 'system.slot.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read A/B slot state' },

  // ── Write (high risk) ───────────────────────────────────────
  { id: 'system.boot.next.write', kind: 'write', risk: 'high', requiresApproval: true, description: 'Set next-boot target' },
  { id: 'system.slot.switch', kind: 'write', risk: 'high', requiresApproval: true, description: 'Switch active A/B slot' },
  { id: 'system.recovery.scheduleBoot', kind: 'write', risk: 'high', requiresApproval: true, description: 'Schedule recovery boot' },
  { id: 'system.boot.splash.apply', kind: 'write', risk: 'high', requiresApproval: true, description: 'Apply boot splash theme' },
  { id: 'system.boot.presentation.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read boot presentation state' },
  { id: 'system.boot.presentation.preview', kind: 'read', risk: 'low', requiresApproval: false, description: 'Preview boot presentation changes' },
  { id: 'system.boot.presentation.apply', kind: 'write', risk: 'high', requiresApproval: true, description: 'Apply boot presentation profile' },
  { id: 'system.boot.presentation.restore', kind: 'write', risk: 'high', requiresApproval: true, description: 'Restore boot presentation' },
  { id: 'system.boot.splash.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read splash state' },
  { id: 'system.boot.splash.restore', kind: 'write', risk: 'high', requiresApproval: true, description: 'Restore splash' },
  { id: 'system.boot.grubTheme.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read GRUB theme' },
  { id: 'system.boot.grubTheme.apply', kind: 'write', risk: 'high', requiresApproval: true, description: 'Apply GRUB theme' },
  { id: 'system.boot.logo.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read boot logo' },
  { id: 'system.boot.logo.capabilities', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read firmware-logo capabilities' },
  { id: 'system.boot.logo.apply', kind: 'write', risk: 'critical', requiresApproval: true, description: 'Apply firmware/OEM logo' },
  { id: 'system.boot.logo.restore', kind: 'write', risk: 'critical', requiresApproval: true, description: 'Restore firmware/OEM logo' },

  // ── Control (high risk) ─────────────────────────────────────
  { id: 'system.power.reboot', kind: 'control', risk: 'high', requiresApproval: true, description: 'Reboot the system' },
  { id: 'system.power.shutdown', kind: 'control', risk: 'high', requiresApproval: true, description: 'Shut down the system' },

  // ── Critical (special policy) ───────────────────────────────
  { id: 'system.firmware.update', kind: 'write', risk: 'critical', requiresApproval: true, description: 'Update firmware' },
  { id: 'system.firmware.logo.apply', kind: 'write', risk: 'critical', requiresApproval: true, description: 'Replace firmware/OEM logo' },
  { id: 'system.secureBoot.key.write', kind: 'write', risk: 'critical', requiresApproval: true, description: 'Modify Secure Boot keys' },
  { id: 'system.bootloader.replace', kind: 'write', risk: 'critical', requiresApproval: true, description: 'Replace the bootloader' },
];

export function getSystemCapability(id: string): SystemCapabilityDefinition | undefined {
  return SYSTEM_CAPABILITIES.find((c) => c.id === id);
}

export function hasSystemCapability(id: string): boolean {
  return SYSTEM_CAPABILITIES.some((c) => c.id === id);
}

/** Everything NOT in this list is deliberately absent (no remote root). */
export const FORBIDDEN_SYSTEM_OPERATIONS = [
  'system.shell.root',
  'system.firmware.writeArbitrary',
  'system.efivar.writeArbitrary',
] as const;
