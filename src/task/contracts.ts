/** TASK-001 — Task Module contracts. */

export type TaskType =
  | 'implementation' | 'planning' | 'research' | 'design' | 'review' | 'verification'
  | 'testing' | 'deployment' | 'documentation' | 'operation' | 'maintenance'
  | 'approval' | 'manual' | 'custom';

export type TaskStatus =
  | 'draft' | 'ready' | 'queued' | 'in_progress' | 'blocked'
  | 'awaiting_review' | 'verification' | 'failed' | 'completed' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskDependencyKind = 'blocks' | 'blocked_by' | 'requires' | 'related_to' | 'parent_of' | 'child_of' | 'duplicates' | 'supersedes';

export interface TaskDependency {
  readonly taskId: string;
  readonly kind: TaskDependencyKind;
}

export type TaskExecutor =
  | { readonly kind: 'human'; readonly identityId: string }
  | { readonly kind: 'agent'; readonly agentId: string }
  | { readonly kind: 'workflow'; readonly workflowId: string }
  | { readonly kind: 'service'; readonly serviceId: string };

export interface AcceptanceCriterion {
  readonly id: string;
  readonly description: string;
  readonly satisfied: boolean;
}

export interface VerificationRequirement {
  readonly id: string;
  readonly description: string;
  readonly status: 'required' | 'satisfied' | 'failed';
}

export interface EvidenceRequirement {
  readonly id: string;
  readonly description: string;
  readonly evidenceId?: string;
}

export interface TaskExternalBinding {
  readonly integrationId: string;
  readonly provider: string;
  readonly externalId: string;
  readonly externalUrl?: string;
  readonly syncMode: 'none' | 'pull' | 'push' | 'bidirectional';
}

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly type: TaskType;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly milestoneId?: string;
  readonly parentTaskId?: string;
  readonly dependencies: readonly TaskDependency[];
  readonly assignee?: string;
  readonly executor?: TaskExecutor;
  readonly acceptanceCriteria: readonly AcceptanceCriterion[];
  readonly verificationRequirements: readonly VerificationRequirement[];
  readonly evidenceRequirements: readonly EvidenceRequirement[];
  readonly externalBinding?: TaskExternalBinding;
  readonly labels: readonly string[];
  readonly dueAt?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly revision: number;
}

/** TASK-008 — durable execution result. */
export interface TaskResult {
  readonly taskId: string;
  readonly executionId?: string;
  readonly outcome: 'success' | 'failure' | 'partial' | 'indeterminate';
  readonly summary: string;
  readonly artifacts: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly verificationIds: readonly string[];
  readonly completedAt: string;
}

export type TaskEventType =
  | 'task.created' | 'task.updated' | 'task.assigned' | 'task.started' | 'task.blocked'
  | 'task.unblocked' | 'task.completed' | 'task.failed' | 'task.cancelled'
  | 'task.result.recorded';

export interface TaskEvent {
  readonly type: TaskEventType;
  readonly taskId: string;
  readonly at: string;
  readonly data?: unknown;
}
