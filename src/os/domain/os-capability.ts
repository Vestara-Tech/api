/** OS-003 — OS capability registry. */

export type OsOperationKind = 'read' | 'inspect' | 'propose' | 'write' | 'governed';

export interface OsCapabilityDefinition {
  readonly id: string;
  readonly kind: OsOperationKind;
  readonly risk: 'low' | 'medium' | 'high' | 'critical';
  readonly requiresApproval: boolean;
  readonly description: string;
}

/**
 * OS-003 — OS capability registry. Read/inspect/propose capabilities are safe
 * for agents; write/governed capabilities (install, user.delete, update.apply,
 * recovery.execute) require permission + approval. OS never gets arbitrary
 * root execution — privileged writes go through the System Module.
 */
export const OS_CAPABILITIES: readonly OsCapabilityDefinition[] = [
  // ── Read/inspect (safe for agents) ───────────────────────────
  { id: 'os.inspect', kind: 'read', risk: 'low', requiresApproval: false, description: 'Inspect OS state' },
  { id: 'os.packages.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read installed packages' },
  { id: 'os.services.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read service states' },
  { id: 'os.kernel.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read kernel configuration' },
  { id: 'os.users.read', kind: 'read', risk: 'low', requiresApproval: false, description: 'Read OS user mapping' },
  { id: 'os.configuration.propose', kind: 'propose', risk: 'low', requiresApproval: false, description: 'Propose configuration changes' },
  { id: 'os.update.plan', kind: 'propose', risk: 'low', requiresApproval: false, description: 'Plan an OS update' },

  // ── Governed writes (require permission + approval) ──────────
  { id: 'os.package.install', kind: 'governed', risk: 'high', requiresApproval: true, description: 'Install packages' },
  { id: 'os.package.remove', kind: 'governed', risk: 'high', requiresApproval: true, description: 'Remove packages' },
  { id: 'os.package.upgrade', kind: 'governed', risk: 'high', requiresApproval: true, description: 'Upgrade packages' },
  { id: 'os.package.hold', kind: 'governed', risk: 'high', requiresApproval: true, description: 'Hold packages' },
  { id: 'os.package.repositories', kind: 'governed', risk: 'high', requiresApproval: true, description: 'Manage package repositories' },
  { id: 'os.user.create', kind: 'governed', risk: 'high', requiresApproval: true, description: 'Create OS user accounts' },
  { id: 'os.user.delete', kind: 'governed', risk: 'high', requiresApproval: true, description: 'Delete OS user accounts' },
  { id: 'os.update.apply', kind: 'governed', risk: 'critical', requiresApproval: true, description: 'Apply OS updates' },
  { id: 'os.recovery.execute', kind: 'governed', risk: 'critical', requiresApproval: true, description: 'Execute recovery' },
  { id: 'os.kernel.apply', kind: 'governed', risk: 'critical', requiresApproval: true, description: 'Apply kernel configuration' },
];

export function getOsCapability(id: string): OsCapabilityDefinition | undefined {
  return OS_CAPABILITIES.find((c) => c.id === id);
}

export function hasOsCapability(id: string): boolean {
  return OS_CAPABILITIES.some((c) => c.id === id);
}

export const FORBIDDEN_OS_OPERATIONS = [
  'os.shell.root',
  'os.exec.arbitrary',
  'os.filesystem.writeArbitrary',
] as const;
