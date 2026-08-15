import { badRequest } from '../../core/errors.js';
import type { WorkflowDefinition, WorkflowStepDefinition, WorkflowStepRunStatus } from './contracts.js';

export interface GraphValidationResult {
  readonly ok: boolean;
  readonly issues: readonly { stepId: string; message: string }[];
  readonly order?: readonly string[];
}

/**
 * WF-003 — Graph model. Workflows are DAGs over steps. Validates dependency
 * integrity (no cycles, no unknown dependencies, entry/exit sanity) and
 * computes a topological order for scheduling.
 */
export class WorkflowGraph {
  private readonly steps: ReadonlyMap<string, WorkflowStepDefinition>;
  private readonly adjacency: ReadonlyMap<string, readonly string[]>;

  constructor(definition: WorkflowDefinition) {
    this.steps = new Map(definition.steps.map((s) => [s.id, s]));
    this.adjacency = new Map(
      definition.steps.map((s) => [s.id, s.dependsOn ?? []]),
    );
  }

  get(id: string): WorkflowStepDefinition {
    const step = this.steps.get(id);
    if (!step) throw badRequest(`Workflow step "${id}" not found`);
    return step;
  }

  has(id: string): boolean {
    return this.steps.has(id);
  }

  list(): readonly WorkflowStepDefinition[] {
    return [...this.steps.values()];
  }

  dependenciesOf(id: string): readonly string[] {
    return this.adjacency.get(id) ?? [];
  }

  /** Steps that directly depend on the given step. */
  dependentsOf(id: string): readonly string[] {
    return [...this.adjacency.entries()].filter(([, deps]) => deps.includes(id)).map(([stepId]) => stepId);
  }

  validate(): GraphValidationResult {
    const issues: { stepId: string; message: string }[] = [];
    if (this.steps.size === 0) {
      return { ok: false, issues: [{ stepId: '', message: 'workflow has no steps' }] };
    }

    // Unknown dependencies.
    for (const step of this.steps.values()) {
      for (const dep of step.dependsOn ?? []) {
        if (!this.steps.has(dep)) {
          issues.push({ stepId: step.id, message: `depends on unknown step "${dep}"` });
        }
      }
    }

    // Cycle detection via DFS.
    const cycle = this.findCycle();
    if (cycle) {
      issues.push({ stepId: cycle[0] ?? '', message: `dependency cycle detected: ${cycle.join(' -> ')}` });
    }

  const order = this.topologicalOrder();
  return { ok: issues.length === 0, issues, ...(order !== null ? { order } : {}) };
  }

  /** Kahn's algorithm; returns null on cycle. */
  topologicalOrder(): readonly string[] | null {
    const indegree = new Map<string, number>();
    for (const step of this.steps.values()) {
      indegree.set(step.id, (step.dependsOn ?? []).length);
    }
    const queue = [...indegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
    const order: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      for (const dep of this.dependentsOf(id)) {
        const next = (indegree.get(dep) ?? 0) - 1;
        indegree.set(dep, next);
        if (next === 0) queue.push(dep);
      }
    }
    return order.length === this.steps.size ? order : null;
  }

  private findCycle(): readonly string[] | null {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    for (const id of this.steps.keys()) color.set(id, WHITE);

    const visit = (id: string, path: string[]): readonly string[] | null => {
      color.set(id, GRAY);
      path.push(id);
      for (const dep of this.adjacency.get(id) ?? []) {
        if (!this.steps.has(dep)) continue;
        const c = color.get(dep);
        if (c === GRAY) {
          const start = path.indexOf(dep);
          return [...path.slice(start), dep];
        }
        if (c === WHITE) {
          const found = visit(dep, path);
          if (found) return found;
        }
      }
      path.pop();
      color.set(id, BLACK);
      return null;
    };

    for (const id of this.steps.keys()) {
      if (color.get(id) === WHITE) {
        const found = visit(id, []);
        if (found) return found;
      }
    }
    return null;
  }

  /** Compute a ready set given completed steps (respecting dependencies). */
  readySteps(completed: ReadonlySet<string>): readonly string[] {
    const ready: string[] = [];
    for (const step of this.steps.values()) {
      if (completed.has(step.id)) continue;
      const deps = step.dependsOn ?? [];
      if (deps.every((d) => completed.has(d))) ready.push(step.id);
    }
    return ready.sort();
  }
}

export function stepStatusOf(result: unknown, error: string | undefined): WorkflowStepRunStatus {
  if (error !== undefined) return 'failed';
  return result === 'SKIPPED' ? 'skipped' : 'completed';
}
