import { badRequest } from '../../core/errors.js';
import type { TaskStatus } from '../contracts.js';

/**
 * TASK-002 — Task lifecycle. Configurable transition policy: manual tasks take
 * the short path, engineering tasks the full review/verification path.
 */
export interface TaskLifecyclePolicy {
  readonly from: TaskStatus;
  readonly to: readonly TaskStatus[];
}

const STANDARD_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  draft: ['ready', 'cancelled'],
  ready: ['queued', 'in_progress', 'cancelled'],
  queued: ['in_progress', 'cancelled'],
  in_progress: ['blocked', 'awaiting_review', 'verification', 'completed', 'failed', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  awaiting_review: ['verification', 'in_progress', 'failed'],
  verification: ['completed', 'failed', 'in_progress'],
  failed: ['in_progress', 'queued', 'ready', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class TaskLifecycle {
  private readonly policies: Map<string, { from: TaskStatus; to: readonly TaskStatus[] }[]>;

  constructor(policies?: readonly TaskLifecyclePolicy[]) {
    this.policies = new Map();
    if (policies) {
      for (const policy of policies) {
        const list = this.policies.get(policy.from) ?? [];
        list.push({ from: policy.from, to: policy.to });
        this.policies.set(policy.from, list);
      }
    }
  }

  transition(from: TaskStatus, to: TaskStatus): TaskStatus {
    const allowed = this.policies.size > 0 ? this.allowedByPolicies(from, to) : (STANDARD_TRANSITIONS[from] ?? []).includes(to);
    if (!allowed) throw badRequest(`Invalid task transition: ${from} → ${to}`);
    return to;
  }

  private allowedByPolicies(from: TaskStatus, to: TaskStatus): boolean {
    const policies = this.policies.get(from) ?? [];
    return policies.some((p) => p.to.includes(to));
  }

  static standard(): TaskLifecycle {
    return new TaskLifecycle();
  }

  static manualOnly(): TaskLifecycle {
    return new TaskLifecycle([{ from: 'ready', to: ['in_progress'] }, { from: 'in_progress', to: ['completed', 'blocked', 'cancelled'] }]);
  }
}
