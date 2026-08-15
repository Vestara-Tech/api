/** SYS-055/057 — Approval workflow V2 + rollback framework. */

import { randomId } from '../../core/identifiers.js';
import type { SystemOperationJournalEntry, SystemOperationKind } from './system-operations.js';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export type ApprovalPolicyLevel = 'single' | 'dual' | 'quorum';

export interface ApprovalPolicy {
  readonly id: string;
  readonly risk: 'low' | 'medium' | 'high' | 'critical';
  readonly level: ApprovalPolicyLevel;
  readonly requiredApprovers: number;
  readonly expiryMinutes: number;
}

export interface ApprovalRequest {
  readonly id: string;
  readonly operationId: string;
  readonly kind: SystemOperationKind;
  readonly policy: ApprovalPolicy;
  readonly status: ApprovalStatus;
  readonly approvals: readonly string[];
  readonly required: number;
  readonly requestedAt: string;
  readonly expiresAt: string;
  readonly decidedAt?: string;
  readonly decision?: 'approved' | 'rejected';
}

export interface ApprovalStorePort {
  save(request: ApprovalRequest): void;
  get(id: string): ApprovalRequest | undefined;
  list(): readonly ApprovalRequest[];
}

export class InMemoryApprovalStore implements ApprovalStorePort {
  private readonly requests = new Map<string, ApprovalRequest>();

  save(request: ApprovalRequest): void {
    this.requests.set(request.id, request);
  }

  get(id: string): ApprovalRequest | undefined {
    return this.requests.get(id);
  }

  list(): readonly ApprovalRequest[] {
    return [...this.requests.values()].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }
}

const POLICY_BY_RISK: Record<'low' | 'medium' | 'high' | 'critical', ApprovalPolicy> = {
  low: { id: 'policy-low', risk: 'low', level: 'single', requiredApprovers: 1, expiryMinutes: 30 },
  medium: { id: 'policy-medium', risk: 'medium', level: 'single', requiredApprovers: 1, expiryMinutes: 30 },
  high: { id: 'policy-high', risk: 'high', level: 'single', requiredApprovers: 1, expiryMinutes: 15 },
  critical: { id: 'policy-critical', risk: 'critical', level: 'dual', requiredApprovers: 2, expiryMinutes: 10 },
};

/**
 * SYS-055 — Approval workflow V2. Critical operations require a dual
 * approval; high-risk a single approval; expiry is enforced. An approved
 * operation can be executed by the daemon; a rejected/expired one cannot.
 */
export class ApprovalWorkflow {
  private readonly store: ApprovalStorePort;

  constructor(store: ApprovalStorePort = new InMemoryApprovalStore()) {
    this.store = store;
  }

  create(operation: { id: string; kind: SystemOperationKind; risk: 'low' | 'medium' | 'high' | 'critical' }): ApprovalRequest {
    const now = Date.now();
    const policy = POLICY_BY_RISK[operation.risk];
    const request: ApprovalRequest = {
      id: randomId('appr'),
      operationId: operation.id,
      kind: operation.kind,
      policy,
      status: 'pending',
      approvals: [],
      required: policy.requiredApprovers,
      requestedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + policy.expiryMinutes * 60 * 1000).toISOString(),
    };
    this.store.save(request);
    return request;
  }

  approve(id: string, approver: string): ApprovalRequest {
    const request = this.store.get(id);
    if (!request) throw new Error(`Approval request "${id}" not found`);
    if (request.status !== 'pending') throw new Error(`Approval request "${id}" is not pending`);
    if (Date.parse(request.expiresAt) < Date.now()) {
      const expired: ApprovalRequest = { ...request, status: 'expired' };
      this.store.save(expired);
      return expired;
    }
    if (request.approvals.includes(approver)) throw new Error(`Approver "${approver}" already approved`);

    const approvals = [...request.approvals, approver];
    if (approvals.length >= request.required) {
      const decided: ApprovalRequest = { ...request, approvals, status: 'approved', decision: 'approved', decidedAt: new Date().toISOString() };
      this.store.save(decided);
      return decided;
    }
    const updated: ApprovalRequest = { ...request, approvals };
    this.store.save(updated);
    return updated;
  }

  reject(id: string, reason?: string): ApprovalRequest {
    const request = this.store.get(id);
    if (!request) throw new Error(`Approval request "${id}" not found`);
    if (request.status !== 'pending') throw new Error(`Approval request "${id}" is not pending`);
    const decided: ApprovalRequest = { ...request, status: 'rejected', decision: 'rejected', decidedAt: new Date().toISOString() };
    this.store.save(decided);
    return decided;
  }

  isApproved(id: string): boolean {
    const request = this.store.get(id);
    if (!request) return false;
    if (request.status === 'pending' && Date.parse(request.expiresAt) < Date.now()) {
      const expired: ApprovalRequest = { ...request, status: 'expired' };
      this.store.save(expired);
      return false;
    }
    return request.status === 'approved';
  }

  list(): readonly ApprovalRequest[] {
    return this.store.list();
  }

  get(id: string): ApprovalRequest | undefined {
    return this.store.get(id);
  }
}

/** SYS-057 — Rollback framework. Stateful mutating operations capture a pre-image to undo. */
export interface RollbackPoint {
  readonly id: string;
  readonly operationId: string;
  readonly target: string;
  readonly kind: string;
  readonly preImage: unknown;
  readonly capturedAt: string;
}

export interface RollbackStorePort {
  save(point: RollbackPoint): void;
  get(id: string): RollbackPoint | undefined;
  list(): readonly RollbackPoint[];
  remove(id: string): void;
}

export class InMemoryRollbackStore implements RollbackStorePort {
  private readonly points = new Map<string, RollbackPoint>();

  save(point: RollbackPoint): void {
    this.points.set(point.id, point);
  }

  get(id: string): RollbackPoint | undefined {
    return this.points.get(id);
  }

  list(): readonly RollbackPoint[] {
    return [...this.points.values()];
  }

  remove(id: string): void {
    this.points.delete(id);
  }
}

/**
 * SYS-057 — Rollback framework. Before a mutating operation executes, the
 * pre-image is captured; on failure the pre-image restores the prior state.
 * The daemon owns the actual restore; this framework owns the bookkeeping.
 */
export class RollbackFramework {
  private readonly store: RollbackStorePort;

  constructor(store: RollbackStorePort = new InMemoryRollbackStore()) {
    this.store = store;
  }

  capture(options: { operationId: string; target: string; kind: string; preImage: unknown }): RollbackPoint {
    const point: RollbackPoint = {
      id: randomId('rb'),
      operationId: options.operationId,
      target: options.target,
      kind: options.kind,
      preImage: options.preImage,
      capturedAt: new Date().toISOString(),
    };
    this.store.save(point);
    return point;
  }

  get(id: string): RollbackPoint | undefined {
    return this.store.get(id);
  }

  pointsFor(operationId: string): readonly RollbackPoint[] {
    return this.store.list().filter((p) => p.operationId === operationId);
  }

  commit(operationId: string): void {
    for (const point of this.pointsFor(operationId)) this.store.remove(point.id);
  }

  rollbackAll(operationId: string): readonly RollbackPoint[] {
    const points = this.pointsFor(operationId);
    for (const point of points) this.store.remove(point.id);
    return points;
  }
}
