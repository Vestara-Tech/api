import { badRequest } from '../../core/errors.js';
import type { Milestone, MilestoneEvent, MilestoneProgress, MilestoneStatus, ProgressWeights, SuccessCriterion, EvidenceRequirement } from '../contracts.js';
import { MilestoneStore } from '../store/milestone-store.js';
import { MilestoneProgressEngine, classifyHealth } from '../domain/progress-engine.js';
import type { Task } from '../../task/contracts.js';

export interface MilestoneServiceOptions {
  readonly store: MilestoneStore;
  readonly progress: MilestoneProgressEngine;
  readonly resolveTasks: (milestoneId: string) => readonly Task[];
  readonly resolveChildren?: (milestoneId: string) => readonly Milestone[];
}

/**
 * MS — Milestone service. Desired outcome / checkpoint. Progress is derived;
 * completion requires success criteria satisfied + evidence.
 */
export class MilestoneService {
  private readonly store: MilestoneStore;
  private readonly progress: MilestoneProgressEngine;
  private readonly resolveTasks: (milestoneId: string) => readonly Task[];
  private readonly resolveChildren: (milestoneId: string) => readonly Milestone[];
  private readonly eventRecords: MilestoneEvent[] = [];

  constructor(options: MilestoneServiceOptions) {
    this.store = options.store;
    this.progress = options.progress;
    this.resolveTasks = options.resolveTasks;
    this.resolveChildren = options.resolveChildren ?? (() => []);
  }

  createMilestone(input: { id: string; title: string; objective: string; parentMilestoneId?: string; targetDate?: string; successCriteria?: SuccessCriterion[]; evidenceRequirements?: EvidenceRequirement[] }): Milestone {
    const milestone: Milestone = {
      id: input.id,
      title: input.title,
      objective: input.objective,
      status: 'draft',
      successCriteria: input.successCriteria ?? [],
      evidenceRequirements: input.evidenceRequirements ?? [],
      taskIds: [],
      childMilestoneIds: [],
      progress: { completion: 0, execution: 0, health: 'unknown', completedTasks: 0, totalTasks: 0, blockedTasks: 0 },
      metadata: {},
      revision: 0,
      ...(input.parentMilestoneId !== undefined ? { parentMilestoneId: input.parentMilestoneId } : {}),
      ...(input.targetDate !== undefined ? { targetDate: input.targetDate } : {}),
    };
    const created = this.store.create(milestone);
    this.emit('milestone.created', created.id);
    return created;
  }

  getMilestone(id: string): Milestone {
    return this.store.get(id);
  }

  listMilestones(): readonly Milestone[] {
    return this.store.list();
  }

  children(id: string): readonly Milestone[] {
    return this.resolveChildren(id);
  }

  /** MS-005 — task membership: add a task and recompute progress. */
  addTask(milestoneId: string, taskId: string): Milestone {
    const milestone = this.store.get(milestoneId);
    if (milestone.taskIds.includes(taskId)) return this.recompute(milestoneId);
    const next = this.store.save({ ...milestone, taskIds: [...milestone.taskIds, taskId], revision: milestone.revision + 1 });
    this.emit('milestone.task.added', milestoneId, { taskId });
    return this.recompute(milestoneId);
  }

  transition(milestoneId: string, to: MilestoneStatus): Milestone {
    const milestone = this.store.get(milestoneId);
    const next = this.store.save({ ...milestone, status: to, revision: milestone.revision + 1 });
    this.emit('milestone.status', milestoneId, { status: to });
    return this.recompute(milestoneId);
  }

  /** MS-006 — recompute derived progress from task state. */
  recompute(milestoneId: string): Milestone {
    const milestone = this.store.get(milestoneId);
    const tasks = this.resolveTasks(milestoneId);
    const progress = this.progress.calculate(tasks);
    const status: MilestoneStatus = progress.blockedTasks > 0 ? 'blocked' : milestone.status;
    const next = this.store.save({ ...milestone, progress, ...(status !== milestone.status ? { status } : {}), revision: milestone.revision + 1 });
    this.emit('milestone.progress', milestoneId, { progress });
    return next;
  }

  progressOf(milestoneId: string): MilestoneProgress {
    return this.recompute(milestoneId).progress;
  }

  /** MS-007 — health/risk. */
  healthOf(milestoneId: string): { health: Milestone['progress']['health']; blockedTasks: number; totalTasks: number } {
    const progress = this.progressOf(milestoneId);
    return { health: progress.health, blockedTasks: progress.blockedTasks, totalTasks: progress.totalTasks };
  }

  updateSuccessCriteria(milestoneId: string, criteria: readonly SuccessCriterion[]): Milestone {
    const milestone = this.store.get(milestoneId);
    return this.store.save({ ...milestone, successCriteria: [...criteria], revision: milestone.revision + 1 });
  }

  /**
   * MS-009 — verification/evidence gate. Milestone completes only when all
   * tasks complete, all success criteria are satisfied, and all evidence
   * requirements carry evidence.
   */
  verify(milestoneId: string): { ok: boolean; reasons: readonly string[] } {
    const milestone = this.store.get(milestoneId);
    const tasks = this.resolveTasks(milestoneId);
    const reasons: string[] = [];
    if (tasks.some((t) => t.status !== 'completed')) reasons.push('not all tasks are completed');
    if (milestone.successCriteria.some((c: { satisfied: boolean }) => !c.satisfied)) reasons.push('not all success criteria are satisfied');
    if (milestone.evidenceRequirements.some((e: { evidenceId?: string }) => !e.evidenceId)) reasons.push('evidence requirements are not met');
    this.emit('milestone.verified', milestoneId, { ok: reasons.length === 0 });
    return { ok: reasons.length === 0, reasons };
  }

  /** Complete a milestone only through the evidence gate. */
  complete(milestoneId: string): { milestone: Milestone; ok: boolean; reasons: readonly string[] } {
    const gate = this.verify(milestoneId);
    if (!gate.ok) throw badRequest(`Milestone cannot complete: ${gate.reasons.join('; ')}`);
    const milestone = this.store.get(milestoneId);
    const next = this.store.save({ ...milestone, status: 'completed', revision: milestone.revision + 1 });
    this.emit('milestone.completed', milestoneId);
    return { milestone: next, ok: true, reasons: [] };
  }

  events(): readonly MilestoneEvent[] {
    return [...this.eventRecords];
  }

  listEvents(): readonly MilestoneEvent[] {
    return this.events();
  }

  private emit(type: MilestoneEvent['type'], milestoneId: string, data?: unknown): void {
    this.eventRecords.push({ type, milestoneId, at: new Date().toISOString(), ...(data !== undefined ? { data } : {}) });
  }
}

export { classifyHealth };
export type { ProgressWeights };
