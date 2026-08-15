/** SYS-052/061/062 — vestara-systemd execution plane + config reconciliation. */

import type { SystemOperationKind } from './system-operations.js';

export interface TypedOperationHandler {
  readonly kind: SystemOperationKind;
  /** Returns the new state (or the pre-image in case of partial failure). */
  execute(target: string, payload?: Readonly<Record<string, unknown>>): Promise<{ ok: boolean; message?: string; preImage?: unknown }>;
}

/**
 * SYS-052 — vestara-systemd daemon. The privileged execution plane that owns
 * systemd, /sys, /proc, /dev, efivarfs, GRUB, Plymouth and hardware access.
 * It executes ONLY typed operations registered by handlers — never arbitrary
 * commands. The API never sees a shell.
 */
export class VestaraSystemDaemon {
  private readonly handlers = new Map<SystemOperationKind, TypedOperationHandler>();

  register(handler: TypedOperationHandler): void {
    this.handlers.set(handler.kind, handler);
  }

  has(kind: SystemOperationKind): boolean {
    return this.handlers.has(kind);
  }

  async execute(kind: SystemOperationKind, target: string, payload?: Readonly<Record<string, unknown>>): Promise<{ ok: boolean; message?: string; preImage?: unknown }> {
    const handler = this.handlers.get(kind);
    if (!handler) {
      return { ok: false, message: `no handler registered for "${kind}"` };
    }
    return handler.execute(target, payload);
  }

  /** The daemon refuses kinds it does not implement — never falls back to a shell. */
  refuses(kind: string): boolean {
    return !this.handlers.has(kind as SystemOperationKind);
  }
}

/** Dev daemon: registers no real handlers; reports unavailable honestly. */
export function devSystemDaemon(): VestaraSystemDaemon {
  const daemon = new VestaraSystemDaemon();
  daemon.register({
    kind: 'system.service.restart',
    execute: async (target) => ({ ok: false, message: `vestara-systemd is not installed in this environment; cannot restart ${target}` }),
  });
  daemon.register({
    kind: 'system.power.reboot',
    execute: async () => ({ ok: false, message: 'vestara-systemd is not installed in this environment' }),
  });
  return daemon;
}

export type ReconciliationStatus = 'in-sync' | 'drift-detected' | 'error';

export interface ReconciliationResult {
  readonly status: ReconciliationStatus;
  readonly diff: readonly { key: string; desired: unknown; current: unknown }[];
  readonly checkedAt: string;
}

/**
 * SYS-061/062 — System reconciler. Configuration declares desired state;
 * System performs controlled reconciliation (desired vs current -> diff ->
 * plan -> approval -> apply -> verify). No direct OS file writes.
 */
export class SystemReconciler {
  constructor(private readonly readCurrent: (key: string) => unknown | undefined) {}

  reconcile(desired: Readonly<Record<string, unknown>>): ReconciliationResult {
    const diff: { key: string; desired: unknown; current: unknown }[] = [];
    for (const [key, value] of Object.entries(desired)) {
      const current = this.readCurrent(key);
      if (current !== value) diff.push({ key, desired: value, current });
    }
    return { status: diff.length === 0 ? 'in-sync' : 'drift-detected', diff, checkedAt: new Date().toISOString() };
  }
}
