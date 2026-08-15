/** SYS-052/053/056 — Privileged operation protocol + operation journal. */

import { randomId } from '../../core/identifiers.js';

export type SystemOperationKind =
  | 'system.service.restart'
  | 'system.power.reboot'
  | 'system.power.shutdown'
  | 'system.mount.create'
  | 'system.mount.remove'
  | 'system.grub.apply'
  | 'system.plymouth.apply'
  | 'system.boot.nextSlot'
  | 'system.recovery.schedule'
  | 'system.firmware.logo.apply'
  | 'system.uefi.variable.set'
  | 'system.kernel.param.set'
  | 'system.secureBoot.key.enroll';

export type SystemOperationRisk = 'low' | 'medium' | 'high' | 'critical';

export interface SystemOperationRequest {
  readonly id: string;
  readonly kind: SystemOperationKind;
  readonly risk: SystemOperationRisk;
  readonly target: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly requestedBy: string;
  readonly requestedAt: string;
}

export type SystemOperationStatus = 'requested' | 'authorized' | 'approved' | 'executing' | 'completed' | 'failed' | 'rejected' | 'cancelled';

export interface SystemOperationJournalEntry {
  readonly id: string;
  readonly kind: SystemOperationKind;
  readonly risk: SystemOperationRisk;
  readonly target: string;
  readonly status: SystemOperationStatus;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly authorizedAt?: string;
  readonly approvedAt?: string;
  readonly completedAt?: string;
  readonly error?: string;
  readonly approvedBy?: string;
}

export interface SystemOperationStorePort {
  save(entry: SystemOperationJournalEntry): void;
  get(id: string): SystemOperationJournalEntry | undefined;
  list(): readonly SystemOperationJournalEntry[];
}

export class InMemorySystemOperationStore implements SystemOperationStorePort {
  private readonly entries = new Map<string, SystemOperationJournalEntry>();

  save(entry: SystemOperationJournalEntry): void {
    this.entries.set(entry.id, entry);
  }

  get(id: string): SystemOperationJournalEntry | undefined {
    return this.entries.get(id);
  }

  list(): readonly SystemOperationJournalEntry[] {
    return [...this.entries.values()].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }
}

export interface SystemOperationExecutorPort {
  execute(kind: SystemOperationKind, target: string, payload?: Readonly<Record<string, unknown>>): Promise<{ ok: boolean; message?: string }>;
}

/** Risk table for typed operations. */
export const SYSTEM_OPERATION_RISK: Record<SystemOperationKind, SystemOperationRisk> = {
  'system.service.restart': 'high',
  'system.power.reboot': 'critical',
  'system.power.shutdown': 'critical',
  'system.mount.create': 'medium',
  'system.mount.remove': 'medium',
  'system.grub.apply': 'high',
  'system.plymouth.apply': 'medium',
  'system.boot.nextSlot': 'high',
  'system.recovery.schedule': 'high',
  'system.firmware.logo.apply': 'critical',
  'system.uefi.variable.set': 'critical',
  'system.kernel.param.set': 'high',
  'system.secureBoot.key.enroll': 'critical',
};

/**
 * SYS-052/053 — Privileged operation protocol. HTTP/API -> Permission ->
 * System Capability -> Typed Operation -> Approval (if required) ->
 * vestara-systemd daemon -> Specific Adapter. Arbitrary root operations are
 * deliberately not expressible. Every operation is journaled (SYS-056).
 */
export class SystemOperationBroker {
  private readonly store: SystemOperationStorePort;
  private readonly executor: SystemOperationExecutorPort;

  constructor(store: SystemOperationStorePort, executor: SystemOperationExecutorPort) {
    this.store = store;
    this.executor = executor;
  }

  request(kind: SystemOperationKind, target: string, requestedBy: string, payload?: Readonly<Record<string, unknown>>): SystemOperationJournalEntry {
    const now = new Date().toISOString();
    const risk = SYSTEM_OPERATION_RISK[kind];
    const entry: SystemOperationJournalEntry = {
      id: randomId('op'),
      kind,
      risk,
      target,
      status: 'requested',
      requestedBy,
      requestedAt: now,
    };
    this.store.save(entry);
    return entry;
  }

  authorize(id: string): SystemOperationJournalEntry {
    return this.update(id, { status: 'authorized', authorizedAt: new Date().toISOString() });
  }

  approve(id: string, approvedBy: string): SystemOperationJournalEntry {
    return this.update(id, { status: 'approved', approvedAt: new Date().toISOString(), approvedBy });
  }

  reject(id: string): SystemOperationJournalEntry {
    return this.update(id, { status: 'rejected' });
  }

  cancel(id: string): SystemOperationJournalEntry {
    return this.update(id, { status: 'cancelled' });
  }

  async execute(id: string): Promise<SystemOperationJournalEntry> {
    const entry = this.store.get(id);
    if (!entry) throw new Error(`Operation "${id}" not found`);
    if (entry.status !== 'approved') throw new Error(`Operation "${id}" must be approved before execution`);
    this.update(id, { status: 'executing' });
    const result = await this.executor.execute(entry.kind, entry.target);
    if (result.ok) {
      return this.update(id, { status: 'completed', completedAt: new Date().toISOString() });
    }
    const error = result.message;
    return this.update(id, { status: 'failed', completedAt: new Date().toISOString(), ...(error !== undefined ? { error } : {}) });
  }

  journal(): readonly SystemOperationJournalEntry[] {
    return this.store.list();
  }

  get(id: string): SystemOperationJournalEntry | undefined {
    return this.store.get(id);
  }

  private update(id: string, patch: Partial<SystemOperationJournalEntry>): SystemOperationJournalEntry {
    const current = this.store.get(id);
    if (!current) throw new Error(`Operation "${id}" not found`);
    const updated: SystemOperationJournalEntry = { ...current, ...patch };
    this.store.save(updated);
    return updated;
  }
}

/** Dev executor: honestly reports no privileged daemon. */
export class DevSystemOperationExecutor implements SystemOperationExecutorPort {
  async execute(kind: SystemOperationKind): Promise<{ ok: boolean; message?: string }> {
    return { ok: false, message: `no privileged vestara-systemd daemon in this environment (${kind})` };
  }
}
