import { randomId } from '../../core/identifiers.js';
import type { Task, TaskEvent, TaskExecutor, TaskResult, TaskStatus } from '../contracts.js';
import { TaskStore } from '../store/task-store.js';
import { TaskLifecycle } from '../domain/lifecycle.js';
import { TaskDependencyGraph } from '../domain/dependency-graph.js';

export interface TaskServiceOptions {
  readonly store: TaskStore;
  readonly lifecycle?: TaskLifecycle;
}

/**
 * TASK-005..008 — Task service. Owns the work request; workflow/agent own
 * execution. Completion requires evidence: a TaskResult with evidenceIds must
 * be recorded before a task is marked completed.
 */
export class TaskService {
  private readonly store: TaskStore;
  private readonly lifecycle: TaskLifecycle;
  private readonly eventRecords: TaskEvent[] = [];

  constructor(options: TaskServiceOptions) {
    this.store = options.store;
    this.lifecycle = options.lifecycle ?? TaskLifecycle.standard();
  }

  createTask(input: {
    id: string;
    title: string;
    type: Task['type'];
    priority?: Task['priority'];
    description?: string;
    milestoneId?: string;
    parentTaskId?: string;
    dependencies?: Task['dependencies'];
    assignee?: string;
    executor?: TaskExecutor;
    acceptanceCriteria?: Task['acceptanceCriteria'];
    verificationRequirements?: Task['verificationRequirements'];
    evidenceRequirements?: Task['evidenceRequirements'];
    labels?: readonly string[];
  }): Task {
    const task: Task = {
      id: input.id,
      title: input.title,
      type: input.type,
      status: 'draft',
      priority: input.priority ?? 'medium',
      dependencies: input.dependencies ?? [],
      acceptanceCriteria: input.acceptanceCriteria ?? [],
      verificationRequirements: input.verificationRequirements ?? [],
      evidenceRequirements: input.evidenceRequirements ?? [],
      labels: input.labels ?? [],
      metadata: {},
      revision: 0,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.milestoneId !== undefined ? { milestoneId: input.milestoneId } : {}),
      ...(input.parentTaskId !== undefined ? { parentTaskId: input.parentTaskId } : {}),
      ...(input.assignee !== undefined ? { assignee: input.assignee } : {}),
      ...(input.executor !== undefined ? { executor: input.executor } : {}),
    };
    const created = this.store.create(task);
    this.emit('task.created', created.id, { title: created.title, type: created.type });
    return created;
  }

  getTask(id: string): Task {
    return this.store.get(id);
  }

  listTasks(filters?: { status?: Task['status']; milestoneId?: string }): readonly Task[] {
    return this.store.list(filters);
  }

  validateDependencies(): { ok: boolean; cycles: readonly string[][] } {
    const graph = new TaskDependencyGraph(this.store.list());
    return graph.validate();
  }

  readyTasks(): readonly string[] {
    return new TaskDependencyGraph(this.store.list()).readyTasks();
  }

  assign(taskId: string, assignee: string): Task {
    const task = this.store.get(taskId);
    const next = this.store.save({ ...task, assignee });
    this.emit('task.assigned', taskId, { assignee });
    return next;
  }

  setExecutor(taskId: string, executor: TaskExecutor): Task {
    const task = this.store.get(taskId);
    return this.store.save({ ...task, executor });
  }

  transition(taskId: string, to: TaskStatus): Task {
    const task = this.store.get(taskId);
    const nextStatus = this.lifecycle.transition(task.status, to);
    const patch: Partial<Task> = {};
    const started = nextStatus === 'in_progress' && !task.startedAt ? new Date().toISOString() : undefined;
    const completed = nextStatus === 'completed' && !task.completedAt ? new Date().toISOString() : undefined;
    const next = this.store.save({
      ...task,
      ...patch,
      ...(started !== undefined ? { startedAt: started } : {}),
      ...(completed !== undefined ? { completedAt: completed } : {}),
      status: nextStatus,
      revision: task.revision + 1,
    });
    this.emit(nextStatus === 'completed' ? 'task.completed' : nextStatus === 'failed' ? 'task.failed' : nextStatus === 'blocked' ? 'task.blocked' : 'task.updated', taskId);
    return next;
  }

  updateAcceptanceCriteria(taskId: string, criteria: Task['acceptanceCriteria']): Task {
    const task = this.store.get(taskId);
    return this.store.save({ ...task, acceptanceCriteria: criteria, revision: task.revision + 1 });
  }

  /** TASK-008 — record a durable result; completion requires evidence. */
  recordResult(input: { taskId: string; outcome: TaskResult['outcome']; summary: string; evidenceIds?: readonly string[]; artifacts?: readonly string[]; verificationIds?: readonly string[] }): TaskResult {
    const task = this.store.get(input.taskId);
    const result: TaskResult = {
      taskId: input.taskId,
      executionId: randomId('exec'),
      outcome: input.outcome,
      summary: input.summary,
      artifacts: input.artifacts ?? [],
      evidenceIds: input.evidenceIds ?? [],
      verificationIds: input.verificationIds ?? [],
      completedAt: new Date().toISOString(),
    };
    this.store.recordResult(result);
    if (input.outcome === 'success' && input.evidenceIds && input.evidenceIds.length > 0) {
      this.transition(input.taskId, 'completed');
    } else if (input.outcome === 'failure') {
      this.transition(input.taskId, 'failed');
    }
    this.emit('task.result.recorded', input.taskId, { outcome: input.outcome, evidence: input.evidenceIds });
    return result;
  }

  results(taskId: string): readonly TaskResult[] {
    return this.store.listResults(taskId);
  }

  events(): readonly TaskEvent[] {
    return [...this.eventRecords];
  }

  listEvents(): readonly TaskEvent[] {
    return this.events();
  }

  private emit(type: TaskEvent['type'], taskId: string, data?: unknown): void {
    this.eventRecords.push({ type, taskId, at: new Date().toISOString(), ...(data !== undefined ? { data } : {}) });
  }
}
