import { conflict, notFound } from '../../core/errors.js';
import type { Task, TaskResult } from '../contracts.js';

/** TASK-003 — TaskStore (in-memory). */
export class TaskStore {
  private readonly tasks = new Map<string, Task>();
  private readonly results = new Map<string, TaskResult[]>();

  create(task: Task): Task {
    if (this.tasks.has(task.id)) throw conflict(`Task "${task.id}" already exists`);
    this.tasks.set(task.id, task);
    return task;
  }

  get(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) throw notFound(`Task "${id}" not found`);
    return task;
  }

  save(task: Task): Task {
    this.tasks.set(task.id, task);
    return task;
  }

  list(filters?: { status?: Task['status']; milestoneId?: string }): readonly Task[] {
    let all = [...this.tasks.values()];
    if (filters?.status) all = all.filter((t) => t.status === filters.status);
    if (filters?.milestoneId) all = all.filter((t) => t.milestoneId === filters.milestoneId);
    return all.sort((a, b) => a.id.localeCompare(b.id));
  }

  recordResult(result: TaskResult): void {
    const list = this.results.get(result.taskId) ?? [];
    list.push(result);
    this.results.set(result.taskId, list);
  }

  listResults(taskId: string): readonly TaskResult[] {
    return this.results.get(taskId) ?? [];
  }
}
