import type { Task } from '../../task/contracts.js';
import type { MilestoneHealth, MilestoneProgress, ProgressWeights } from '../contracts.js';
import { DEFAULT_PROGRESS_WEIGHTS } from '../contracts.js';

/**
 * MS-006 — Progress engine. Progress is DERIVED from observable task state,
 * never PATCHed. Completion/execution use configurable per-type weights.
 */
export class MilestoneProgressEngine {
  private readonly weights: Required<ProgressWeights>;

  constructor(weights: ProgressWeights = {}) {
    this.weights = { ...DEFAULT_PROGRESS_WEIGHTS, ...weights } as Required<ProgressWeights>;
  }

  calculate(tasks: readonly Task[]): MilestoneProgress {
    const total = tasks.length;
    if (total === 0) {
      return { completion: 0, execution: 0, health: 'unknown', completedTasks: 0, totalTasks: 0, blockedTasks: 0 };
    }
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const blocked = tasks.filter((t) => t.status === 'blocked').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress' || t.status === 'awaiting_review' || t.status === 'verification').length;
    const started = completed + inProgress;

    let completionWeight = 0;
    let totalWeight = 0;
    for (const task of tasks) {
      const weight = this.weightFor(task.type);
      totalWeight += weight;
      if (task.status === 'completed') completionWeight += weight;
      else if (task.status === 'verification') completionWeight += weight * 0.5;
      else if (task.status === 'awaiting_review') completionWeight += weight * 0.75;
    }

    const completion = totalWeight > 0 ? Math.round((completionWeight / totalWeight) * 100) : 0;
    const execution = total > 0 ? Math.round((started / total) * 100) : 0;

    const blockedTask = tasks.find((t) => t.status === 'blocked');
    return {
      completion,
      execution,
      health: classifyHealth(blocked, started, total),
      completedTasks: completed,
      totalTasks: total,
      blockedTasks: blocked,
      ...(blockedTask !== undefined ? { criticalPathTaskId: blockedTask.id } : {}),
    };
  }

  private weightFor(type: string): number {
    switch (type) {
      case 'planning':
        return this.weights.planning;
      case 'implementation':
        return this.weights.implementation;
      case 'testing':
        return this.weights.testing;
      case 'verification':
        return this.weights.verification;
      case 'deployment':
        return this.weights.deployment;
      default:
        return this.weights.other;
    }
  }
}

/** MS-007 — health classification: blocked tasks dominate; in-progress is at-risk. */
export function classifyHealth(blockedTasks: number, startedTasks: number, totalTasks: number): MilestoneHealth {
  if (totalTasks === 0) return 'unknown';
  if (blockedTasks > 0) return 'blocked';
  if (startedTasks === 0) return 'healthy';
  return 'at_risk';
}
