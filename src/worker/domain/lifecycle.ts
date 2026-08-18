import { badRequest } from '../../core/errors.js';
import type { JobStatus } from '../contracts.js';

/** WKR-002 — Job lifecycle state machine. */
export interface JobLifecyclePolicy {
  readonly from: JobStatus;
  readonly to: readonly JobStatus[];
}

const STANDARD_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  pending: ['running', 'cancelled'],
  running: ['retrying', 'completed', 'failed', 'cancelled'],
  retrying: ['running', 'cancelled'],
  completed: [],
  failed: ['retrying'],
  cancelled: [],
};

export class JobLifecycle {
  private readonly policies: Map<JobStatus, { from: JobStatus; to: readonly JobStatus[] }[]>;

  constructor(policies?: readonly JobLifecyclePolicy[]) {
    this.policies = new Map();
    if (policies) {
      for (const policy of policies) {
        const list = this.policies.get(policy.from) ?? [];
        list.push({ from: policy.from, to: policy.to });
        this.policies.set(policy.from, list);
      }
    }
  }

  transition(from: JobStatus, to: JobStatus): JobStatus {
    const allowed = this.policies.size > 0 ? this.allowedByPolicies(from, to) : (STANDARD_TRANSITIONS[from] ?? []).includes(to);
    if (!allowed) throw badRequest(`Invalid job transition: ${from} → ${to}`);
    return to;
  }

  canTransition(from: JobStatus, to: JobStatus): boolean {
    return this.policies.size > 0 ? this.allowedByPolicies(from, to) : (STANDARD_TRANSITIONS[from] ?? []).includes(to);
  }

  private allowedByPolicies(from: JobStatus, to: JobStatus): boolean {
    const policies = this.policies.get(from) ?? [];
    return policies.some((policy) => policy.to.includes(to));
  }

  static standard(): JobLifecycle {
    return new JobLifecycle();
  }
}
