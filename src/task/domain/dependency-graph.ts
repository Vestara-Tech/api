import type { Task, TaskDependency } from '../contracts.js';

/**
 * TASK-004 — Dependency graph. Builds the requires/blocks edges, detects
 * cycles, and computes the ready set (tasks whose dependencies are satisfied).
 */
export class TaskDependencyGraph {
  private readonly tasks: ReadonlyMap<string, Task>;

  constructor(tasks: readonly Task[]) {
    this.tasks = new Map(tasks.map((t) => [t.id, t]));
  }

  dependenciesOf(taskId: string): readonly TaskDependency[] {
    return this.tasks.get(taskId)?.dependencies ?? [];
  }

  /** Direct prerequisites (blocked_by/requires, plus parent). */
  prerequisitesOf(taskId: string): readonly string[] {
    const task = this.tasks.get(taskId);
    if (!task) return [];
    const ids = task.dependencies.filter((d) => d.kind === 'blocked_by' || d.kind === 'requires').map((d) => d.taskId);
    if (task.parentTaskId) ids.push(task.parentTaskId);
    return ids;
  }

  validate(): { ok: boolean; cycles: readonly string[][] } {
    const cycles: string[][] = [];
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    for (const id of this.tasks.keys()) color.set(id, WHITE);

    const visit = (id: string, path: string[]): void => {
      color.set(id, GRAY);
      path.push(id);
      for (const dep of this.prerequisitesOf(id)) {
        if (!this.tasks.has(dep)) continue;
        const c = color.get(dep);
        if (c === GRAY) {
          const start = path.indexOf(dep);
          cycles.push([...path.slice(start), dep]);
        } else if (c === WHITE) {
          visit(dep, path);
        }
      }
      path.pop();
      color.set(id, BLACK);
    };

    for (const id of this.tasks.keys()) {
      if (color.get(id) === WHITE) visit(id, []);
    }
    return { ok: cycles.length === 0, cycles };
  }

  /** Tasks whose prerequisites are all completed. */
  readyTasks(): readonly string[] {
    return [...this.tasks.values()].filter((t) => this.prerequisitesOf(t.id).every((dep) => this.tasks.get(dep)?.status === 'completed')).map((t) => t.id);
  }
}
