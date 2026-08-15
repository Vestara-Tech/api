/** MS-001 — Milestone Module contracts. */

export type MilestoneStatus =
  | 'draft' | 'planned' | 'ready' | 'in_progress' | 'at_risk' | 'blocked'
  | 'verification' | 'completed' | 'cancelled' | 'superseded';

export type MilestoneHealth = 'healthy' | 'at_risk' | 'blocked' | 'unknown';

export interface SuccessCriterion {
  readonly id: string;
  readonly description: string;
  readonly satisfied: boolean;
}

export interface EvidenceRequirement {
  readonly id: string;
  readonly description: string;
  readonly evidenceId?: string;
}

export interface MilestoneProgress {
  readonly completion: number;
  readonly execution: number;
  readonly health: MilestoneHealth;
  readonly completedTasks: number;
  readonly totalTasks: number;
  readonly blockedTasks: number;
  readonly criticalPathTaskId?: string;
}

export interface Milestone {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: MilestoneStatus;
  readonly parentMilestoneId?: string;
  readonly objective: string;
  readonly successCriteria: readonly SuccessCriterion[];
  readonly evidenceRequirements: readonly EvidenceRequirement[];
  readonly taskIds: readonly string[];
  readonly childMilestoneIds: readonly string[];
  readonly targetDate?: string;
  readonly progress: MilestoneProgress;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly revision: number;
}

/** MS-006 — configurable progress weights by task type. */
export interface ProgressWeights {
  readonly planning?: number;
  readonly implementation?: number;
  readonly testing?: number;
  readonly verification?: number;
  readonly deployment?: number;
  readonly other?: number;
}

export const DEFAULT_PROGRESS_WEIGHTS: Required<ProgressWeights> = {
  planning: 0.1,
  implementation: 0.4,
  testing: 0.2,
  verification: 0.2,
  deployment: 0.1,
  other: 0,
};

export type MilestoneEventType =
  | 'milestone.created' | 'milestone.updated' | 'milestone.status'
  | 'milestone.task.added' | 'milestone.progress' | 'milestone.verified' | 'milestone.completed';

export interface MilestoneEvent {
  readonly type: MilestoneEventType;
  readonly milestoneId: string;
  readonly at: string;
  readonly data?: unknown;
}
