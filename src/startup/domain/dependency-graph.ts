import type { StartupServiceDefinition } from './readiness.js';

/**
 * DESK-004 — Startup dependency graph.
 *
 * Services start in dependency order. A service with unresolved (non-ready)
 * required dependencies is `blocked`; optional dependencies that fail only
 * degrade the service.
 */
export interface DependencyNode {
  readonly id: string;
  readonly name: string;
  readonly required: boolean;
  readonly dependencies: readonly string[];
  dependents: string[];
}

export class StartupDependencyGraph {
  private readonly nodes = new Map<string, DependencyNode>();

  constructor(definitions: readonly StartupServiceDefinition[]) {
    for (const def of definitions) {
      this.nodes.set(def.id, {
        id: def.id,
        name: def.name,
        required: def.required,
        dependencies: def.dependsOn ?? [],
        dependents: [],
      });
    }
    for (const node of this.nodes.values()) {
      for (const dep of node.dependencies) {
        const dependent = this.nodes.get(dep);
        if (dependent) dependent.dependents.push(node.id);
      }
    }
  }

  /** Deterministic topological order (stable by id). */
  order(): readonly string[] {
    const visited = new Set<string>();
    const out: string[] = [];
    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (!node) return;
      for (const dep of [...node.dependencies].sort()) visit(dep);
      out.push(id);
    };
    for (const id of [...this.nodes.keys()].sort()) visit(id);
    return out;
  }

  /** Services whose required dependencies are not yet ready. */
  blocked(unresolved: (id: string) => boolean): readonly string[] {
    const out: string[] = [];
    for (const [id, node] of this.nodes) {
      const hasUnresolvedRequired = node.dependencies.some((dep) => unresolved(dep));
      if (hasUnresolvedRequired) out.push(id);
    }
    return out.sort();
  }

  get(id: string): DependencyNode | undefined {
    return this.nodes.get(id);
  }

  count(): number {
    return this.nodes.size;
  }
}
